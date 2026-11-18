const path = require('node:path')
const fs = require('node:fs')
const { isIP } = require('node:net')
const root = path.resolve(__dirname, '..')
const address = process.argv[2] || '127.0.0.1'
if (isIP(address) !== 4) throw new Error('Pass the computer Wi-Fi IPv4 address, or omit it for PC-only access.')
const buildFile=path.join(root,'.zscripts','windows-built-dir')
const distDir=process.argv[3] || (fs.existsSync(buildFile)?fs.readFileSync(buildFile,'utf8').trim():'.next-stable')
if(!['.next','.next-stable','.next-upgrade'].includes(distDir))throw new Error('Invalid local build directory')
const server=path.join(root,distDir,'standalone','server.js')
if (!fs.existsSync(server)) throw new Error('Run node scripts/build-local-stable.cjs first.')
process.env.NODE_ENV = 'production'
process.env.NEXT_LOCAL_STABLE = '1'
process.env.PORT = process.argv[4] || '3000'
process.env.NEXT_LOCAL_DIST=distDir
if(process.env.PORT==='3000'&&distDir!=='.next')fs.writeFileSync(path.join(root,'.zscripts','windows-active-build'),distDir)
process.env.HOSTNAME = address
console.log('Starting stable local app without development auto-reloading.')
async function start(){
  const output=path.dirname(server),http=require('node:http')
  const config=JSON.parse(fs.readFileSync(path.join(root,distDir,'required-server-files.json'),'utf8')).config
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG=JSON.stringify(config)
  process.chdir(output)
  require(path.join(output,'node_modules/next'))
  const{getRequestHandlers}=require(path.join(output,'node_modules/next/dist/server/lib/start-server'))
  const{createProxyServer}=require(path.join(output,'node_modules/next/dist/compiled/http-proxy'))
  const proxy=createProxyServer({target:'http://127.0.0.1:3003',ws:true,xfwd:true})
  proxy.on('error',(error,request,response)=>{console.error('Classroom gateway:',error.message);if(response?.writeHead){if(!response.headersSent)response.writeHead(502,{'Content-Type':'text/plain'});response.end('The classroom service is starting. Please retry.')}else response?.destroy()})
  const realtime=req=>{const u=new URL(req.url,'http://local');return (u.pathname==='/'||u.pathname==='/socket.io/')&&(u.searchParams.has('EIO')||u.searchParams.get('XTransformPort')==='3003')}
  let handlers
  const gateway=http.createServer((req,res)=>{if(realtime(req))proxy.web(req,res);else void handlers.requestHandler(req,res).catch(error=>{console.error(error);if(!res.headersSent)res.writeHead(500);res.end('The app could not respond.')})})
  handlers=await getRequestHandlers({dir:output,port:Number(process.env.PORT),hostname:address,isDev:false,server:gateway})
  gateway.on('upgrade',(req,socket,head)=>{if(realtime(req))proxy.ws(req,socket,head);else void handlers.upgradeHandler(req,socket,head)})
  gateway.listen(Number(process.env.PORT),address,()=>console.log(`App and classroom on http://${address}:${process.env.PORT}`))
}
start().catch(error=>{console.error(error);process.exitCode=1})
