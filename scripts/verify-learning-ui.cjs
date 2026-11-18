// Reuse the isolated CDP test harness; generate a runnable test beside the other temporary test artifacts.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const original=fs.readFileSync(path.join(__dirname,'verify-mobile-experience.cjs'),'utf8')
const prefix=original.slice(0,original.indexOf('async function run()')).replace("const base = 'http://127.0.0.1:3000'","const base = process.env.UI_TEST_URL || 'http://127.0.0.1:3300'")
let startup=original.slice(original.indexOf('  chrome = spawn('),original.indexOf('  await login(student)'))
startup=startup.replace("'--headless=new'","'--headless=new', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'")
const code=prefix+'\nasync function launchBrowser(){\n'+startup+'\n}\n'+fs.readFileSync(path.join(__dirname,'verify-learning-ui-body.cjs'),'utf8')
const target=path.resolve(__dirname,'../.zscripts/learning-ui-generated.cjs');fs.writeFileSync(target,code)
const child=spawnSync(process.execPath,[target],{cwd:path.resolve(__dirname,'..'),env:process.env,stdio:'inherit'})
if(child.error)throw child.error
process.exitCode=child.status||0
