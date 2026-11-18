const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const assets = path.join(root, 'public/pdfjs')
fs.mkdirSync(assets, { recursive: true })
for (const file of ['pdf.worker.min.mjs', 'pdf.renderer.min.mjs']) fs.copyFileSync(path.join(root, 'node_modules/pdfjs-dist/build', file), path.join(assets, file))
for (const folder of ['standard_fonts', 'cmaps', 'wasm']) fs.cpSync(path.join(root, 'node_modules/pdfjs-dist', folder), path.join(assets, folder), { recursive: true })
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], {
  cwd: root, env: { ...process.env, NEXT_LOCAL_STABLE: '0', NODE_ENV: 'production' }, stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status) process.exit(result.status)
const output = path.join(root, '.next/standalone')
fs.cpSync(path.join(root, '.next/static'), path.join(output, '.next/static'), { recursive: true })
fs.cpSync(path.join(root, 'public'), path.join(output, 'public'), { recursive: true })
