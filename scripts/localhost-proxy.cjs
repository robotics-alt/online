// Keep PC localhost available while Next.js is bound to the Wi-Fi interface.
const http = require('node:http')
const { createProxyServer } = require('next/dist/compiled/http-proxy')

const upstream = process.argv[2]
if (!upstream) throw new Error('Pass the app URL, for example http://192.168.100.241:3000')
const proxy = createProxyServer({ target: upstream, ws: true })
proxy.on('error', (error, request, response) => {
  console.error('Local app proxy:', error.message)
  if (response && typeof response.writeHead === 'function') {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' })
    response.end('The app is starting. Please refresh in a moment.')
  } else if (response) response.destroy()
})
const server = http.createServer((request, response) => proxy.web(request, response))
server.on('upgrade', (request, socket, head) => proxy.ws(request, socket, head))
server.listen(3000, '127.0.0.1', () => console.log(`PC app: http://localhost:3000 -> ${upstream}`))
process.on('SIGTERM', () => { proxy.close(); server.close(() => process.exit(0)) })
process.on('SIGINT', () => { proxy.close(); server.close(() => process.exit(0)) })
