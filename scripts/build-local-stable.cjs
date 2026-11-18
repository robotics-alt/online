// Build the local test app separately from the development server's generated files.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const activeFile=path.join(root,'.zscripts','windows-active-build')
const active=fs.existsSync(activeFile)?fs.readFileSync(activeFile,'utf8').trim():'.next-stable'
const distDir=process.env.LOCAL_BUILD_DIR || (active==='.next-upgrade'?'.next-stable':'.next-upgrade')
if(!['.next-stable','.next-upgrade'].includes(distDir))throw new Error('Invalid local build directory')
const pdfPublic=path.join(root,'public','pdfjs')
fs.mkdirSync(pdfPublic,{recursive:true})
for(const file of ['pdf.worker.min.mjs','pdf.renderer.min.mjs'])fs.copyFileSync(path.join(root,'node_modules','pdfjs-dist','build',file),path.join(pdfPublic,file))
for(const directory of ['standard_fonts','cmaps','wasm'])if(fs.existsSync(path.join(root,'node_modules','pdfjs-dist',directory)))fs.cpSync(path.join(root,'node_modules','pdfjs-dist',directory),path.join(pdfPublic,directory),{recursive:true})
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], {
  cwd: root, env: { ...process.env, NEXT_LOCAL_STABLE: '1',NEXT_LOCAL_DIST:distDir, NODE_ENV: 'production' }, stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
const output = path.join(root,distDir,'standalone')
fs.cpSync(path.join(root,distDir,'static'),path.join(output,distDir,'static'),{recursive:true})
fs.cpSync(path.join(root, 'public'), path.join(output, 'public'), { recursive: true })
// Local-only output is ignored by Git. Keep runtime database/session settings with it.
for (const file of ['.env', '.env.local']) if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(output, file))
fs.writeFileSync(path.join(root,'.zscripts','windows-built-dir'),distDir)
console.log('Stable local build ready: '+distDir)
