const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const filename = path.resolve(__dirname, '../src/lib/store.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const loaded = new Module(filename, module)
loaded.filename = filename
loaded.paths = Module._nodeModulePaths(path.dirname(filename))
loaded._compile(compiled, filename)
const { useApp } = loaded.exports
const previousFetch = global.fetch
async function verify() {
  const user = { id: 'local-session-check', name: 'Test user', currency: 'USD', language: 'en', role: 'STUDENT' }
  useApp.getState().setUser(user)
  global.fetch = async () => { throw new Error('Temporary network failure') }
  await useApp.getState().refreshMe()
  assert.equal(useApp.getState().user, user, 'Network failures must preserve the existing user')
  global.fetch = async () => new Response(JSON.stringify({ error: 'Temporary server failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  await useApp.getState().refreshMe()
  assert.equal(useApp.getState().user, user, 'Server errors must preserve the existing user')
  global.fetch = async () => new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  await useApp.getState().refreshMe()
  assert.equal(useApp.getState().user, null, 'A confirmed expired session must still clear the user')
  console.log('Temporary network/server errors preserve sign-in; confirmed expired sessions still clear correctly.')
}
verify().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => { global.fetch = previousFetch })
