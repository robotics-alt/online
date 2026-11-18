// Headless layout checks against isolated local accounts. No external browser profile is used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { randomUUID, randomBytes, scryptSync } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL ||= 'file:' + path.resolve(__dirname, '../db/custom.db').replaceAll('\\', '/')
const db = new PrismaClient()
const base = 'http://127.0.0.1:3000'
const root = path.resolve(__dirname, '../.zscripts')
const profile = path.join(root, 'ui-test-' + randomUUID())
const artifacts = path.join(root, 'ui-checks')
function chromeExecutable(){const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');const cached=fs.existsSync(cache)?fs.readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1])).flatMap(n=>['chrome-win64/chrome.exe','chrome-win/chrome.exe'].map(file=>path.join(cache,n,file))):[];const found=[...cached,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));if(!found)throw Error('A Chromium browser is required for local UI verification');return found}
const password = 'Test-' + randomUUID(), salt = randomBytes(16).toString('hex')
const passwordHash = salt + ':' + scryptSync(password, salt, 64).toString('hex')
const users = [], bookings = [], calls = []
let chrome, websocket, conversationId, sessionId, counter = 0
const pending = new Map(), runtimeErrors = []
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function send(method, params = {}, targetSession = sessionId) {
  const id = ++counter
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)) }, 15000)
    pending.set(id, { resolve, reject, timer }); websocket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }))
  })
}
async function evaluate(expression) {
  const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (data.exceptionDetails) throw new Error(JSON.stringify(data.exceptionDetails))
  return data.result.value
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100) }
  throw new Error('UI condition timed out: ' + expression)
}
async function click(selector) { assert(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), selector); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(300) }
async function pointerClick(selector) {
  const point = await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const rect=element.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2} })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }); await delay(300)
}
async function screenshot(name) { await delay(600); const image = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(image.data, 'base64')) }
async function dimensions(width, height) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }); await delay(300) }
async function checkWidth() { const size = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})'); assert(size.content <= size.width + 1, JSON.stringify(size)) }
async function login(user) {
  assert.equal(await evaluate(`fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({ email: user.email, password })})}).then(r=>r.status)`), 200)
  await evaluate('window.__qaPreviousDocument=true')
  await send('Page.navigate', { url: base });await waitFor('!window.__qaPreviousDocument&&document.readyState==="complete"');await waitFor(`Boolean(document.querySelector('button[aria-label="Account menu"]'))`)
}
async function run() {
  fs.mkdirSync(artifacts, { recursive: true })
  for (const role of ['TUTOR', 'STUDENT']) users.push(await db.user.create({ data: { email: randomUUID() + '@mobile-test.invalid', name: role === 'TUTOR' ? 'Mobile test teacher' : 'Mobile test student', passwordHash, role, status: 'ACTIVE', ...(role === 'TUTOR' ? { tutorProfile: { create: { status: 'APPROVED', faceToFaceEnabled: true } } } : {}) }, include: { tutorProfile: true } }))
  const [teacher, student] = users
  await db.availabilityRule.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tutorId: teacher.tutorProfile.id, weekday, startMin: 480, endMin: 1200 })) })
  for (const offset of [1, -1]) {
    const start = new Date(Date.now() + offset * 86400000)
    const booking = await db.booking.create({ data: { studentId: student.id, tutorId: teacher.id, tutorProfileId: teacher.tutorProfile.id, startUtc: start, endUtc: new Date(+start + 1800000), durationMin: 30, status: offset > 0 ? 'CONFIRMED' : 'COMPLETED', isTrial: true, roomId: randomUUID(), priceCents: 0 } }); bookings.push(booking.id)
  }
  const pair = [teacher.id, student.id].sort()
  const conversation = await db.conversation.create({ data: { participantAId: pair[0], participantBId: pair[1], messages: { create: { senderId: teacher.id, body: 'Welcome! ' + 'A message that wraps within the phone content area. '.repeat(15) } } } }); conversationId = conversation.id
  chrome = spawn(chromeExecutable(), ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await new Promise((resolve, reject) => { let output = ''; const timer = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000); chrome.on('error', reject); chrome.stderr.on('data', (chunk) => { output += chunk; const found = output.match(/DevTools listening on (ws:\/\/\S+)/); if (found) { clearTimeout(timer); resolve(found[1]) } }) })
  websocket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => { websocket.onopen = resolve; websocket.onerror = reject })
  websocket.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails); const item = pending.get(message.id); if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result) } }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null)
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, null)).sessionId
  await send('Runtime.enable'); await send('Page.enable'); await dimensions(390, 844)
  await send('Page.navigate', { url: base }); await waitFor('Boolean(document.querySelector(".mobile-app-nav"))')
  await login(student)
  await click('.mobile-app-nav-item:nth-child(3)'); await waitFor('Boolean(document.querySelector(".student-lesson-card"))'); await checkWidth(); await screenshot('phone-lessons')
  await click('.student-lesson-segments button:nth-child(2)'); await waitFor('Boolean(document.querySelector(".student-lesson-card.is-history"))'); await checkWidth(); await screenshot('phone-history')
  await click('.mobile-app-nav-item:nth-child(4)'); await waitFor('Boolean(document.querySelector(".messenger-person"))'); assert.equal(await evaluate('getComputedStyle(document.querySelector(".messenger-thread")).display'), 'none')
  await click('.messenger-person'); await waitFor('Boolean(document.querySelector(".messenger-message"))')
  for (const [width, height] of [[390, 844], [320, 640]]) {
    await dimensions(width, height); await checkWidth()
    const layout = await evaluate('({scroll:document.documentElement.scrollHeight,height:innerHeight,bottom:document.querySelector(".messenger-compose").getBoundingClientRect().bottom})')
    assert(layout.scroll <= layout.height + 1, JSON.stringify(layout)); assert(layout.bottom <= layout.height + 1 && layout.bottom > layout.height - 90, JSON.stringify(layout))
  }
  await dimensions(390, 844); await screenshot('phone-chat')
  await click('.messenger-back'); assert.equal(await evaluate('getComputedStyle(document.querySelector(".messenger-people")).display'), 'flex')
  await dimensions(1366, 900); await click('.messenger-person'); await checkWidth(); await screenshot('desktop-chat')
  await dimensions(390, 844); await click('.messenger-back'); await click('.mobile-app-nav-item:nth-child(2)')
  await waitFor(`Boolean(document.querySelector('input[placeholder^="Search by name"]'))`)
  await evaluate(`document.querySelector('input[placeholder^="Search by name"]').focus()`); await send('Input.insertText', { text: 'Mobile test teacher' })
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await waitFor(`Array.from(document.querySelectorAll('h3')).some(heading => heading.textContent === 'Mobile test teacher')`)
  await evaluate(`Array.from(Array.from(document.querySelectorAll('h3')).find(heading => heading.textContent === 'Mobile test teacher').closest('.group').querySelectorAll('button')).find(button => button.textContent === 'View profile').click()`)
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => /^[0-9]{1,2}:[0-9]{2}/.test(button.textContent))`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => /^[0-9]{1,2}:[0-9]{2}/.test(button.textContent)).click()`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Book a lesson')).click()`)
  await waitFor(`Boolean(document.querySelector('button[role="radio"][value="FACE_TO_FACE"]'))`)
  await click('button[role="radio"][value="FACE_TO_FACE"]'); await screenshot('phone-face-to-face-booking')
  const checkout = await evaluate('({bottom:document.querySelector("[role=dialog]").getBoundingClientRect().bottom,height:innerHeight})'); assert(checkout.bottom <= checkout.height + 1)
  assert(await evaluate(`document.querySelector('[role=dialog]').textContent.includes('Only administrators can see')`))
  await click('button[role="radio"][value="trial"]'); assert(!await evaluate(`Boolean(document.querySelector('button[role="radio"][value="BANK_TRANSFER"]'))`))
  await screenshot('phone-free-trial-booking')
  await login(teacher)
  await click('button[aria-label="Appearance"]'); await waitFor(`Boolean(document.querySelector('button[aria-label="blue accent"]'))`)
  await click('button[aria-label="blue accent"]'); assert.equal(await evaluate('document.documentElement.dataset.accent'), 'blue')
  await click('[role="group"][aria-label="Theme"] button:nth-child(1)'); assert.equal(await evaluate('document.documentElement.classList.contains("dark")'), false)
  await screenshot('phone-appearance'); await click('button[aria-label="Appearance"]')
  await dimensions(1366, 900)
  const call = await evaluate(`fetch('/api/lesson-calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:${JSON.stringify(bookings[0])}})}).then(r=>r.json()).then(r=>r.call)`); calls.push(call.id)
  await send('Page.navigate', { url: base + '?classroom=' + bookings[0] + '&callId=' + call.id })
  await waitFor(`Boolean(document.querySelector('button[aria-label="Full-screen whiteboard"]'))`)
  assert.equal(await evaluate('document.querySelectorAll(".platform-header,.platform-shell > footer,.mobile-app-nav").length'), 0)
  await click('button[aria-label="Full-screen whiteboard"]')
  const board = await evaluate('({width:document.querySelector(".classroom-board").getBoundingClientRect().width,height:document.querySelector(".classroom-board").getBoundingClientRect().height,vw:innerWidth,vh:innerHeight})')
  assert.equal(board.width, board.vw); assert.equal(board.height, board.vh); await screenshot('teacher-fullscreen-board')
  await login(student); await dimensions(844, 390)
  await send('Page.navigate', { url: base + '?classroom=' + bookings[0] + '&callId=' + call.id })
  await waitFor(`Boolean(document.querySelector('button[aria-label="Full-screen whiteboard"]'))`)
  assert.equal(await evaluate('document.querySelectorAll(".platform-header,.platform-shell > footer,.mobile-app-nav").length'), 0)
  await click('button[aria-label="Full-screen whiteboard"]')
  const studentBoard = await evaluate('({width:document.querySelector(".classroom-board").getBoundingClientRect().width,height:document.querySelector(".classroom-board").getBoundingClientRect().height,vw:innerWidth,vh:innerHeight})')
  assert.equal(studentBoard.width, studentBoard.vw); assert.equal(studentBoard.height, studentBoard.vh); await screenshot('student-landscape-board')
  const admin = await db.user.create({ data: { name: 'Mobile test admin', email: randomUUID() + '@mobile-test.invalid', role: 'ADMIN', status: 'ACTIVE', passwordHash } }); users.push(admin)
  const offlineStart = new Date(Date.now() + 5 * 86400000)
  const approval = await db.booking.create({ data: { studentId: student.id, tutorId: teacher.id, tutorProfileId: teacher.tutorProfile.id, startUtc: offlineStart, endUtc: new Date(+offlineStart + 1800000), status: 'PENDING_PAYMENT', approvalRequired: true, lessonFormat: 'FACE_TO_FACE', priceCents: 2000, paymentMethod: 'BANK_TRANSFER', roomId: randomUUID(), privateDetails: { create: { phone: '+354 555 9911', email: 'private@mobile-test.invalid', location: 'Private test meeting location', paymentReference: 'Mobile test transfer' } } } }); bookings.push(approval.id)
  await db.payment.create({ data: { userId: student.id, refId: approval.id, amountCents: 2000, status: 'PENDING', method: 'BANK_TRANSFER', purpose: 'LESSON' } })
  await dimensions(1366, 900); await login(admin); await pointerClick('button[aria-label="Account menu"]')
  await waitFor(`Array.from(document.querySelectorAll('[role=menuitem]')).some(item => item.textContent.includes('Admin console'))`)
  await evaluate(`Array.from(document.querySelectorAll('[role=menuitem]')).find(item => item.textContent.includes('Admin console')).click()`)
  await waitFor(`Boolean(document.querySelector('[role=tab][aria-label="Bookings"]'))`); await pointerClick('[role=tab][aria-label="Bookings"]')
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Review payment')`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Review payment').click()`)
  await waitFor(`Boolean(document.querySelector('[role=dialog]'))`)
  assert(await evaluate(`document.querySelector('[role=dialog]').textContent.includes('Private test meeting location')`))
  assert(await evaluate(`Array.from(document.querySelectorAll('[role=dialog] button')).find(button => button.textContent === 'Approve appointment').disabled`))
  await screenshot('admin-payment-review')
  assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors))
  console.log('Mobile lessons/chat, private face-to-face checkout, free trial payment bypass, appearance preferences, standalone classroom and teacher/student landscape board passed')
}
run().catch(async (err) => { console.error(err.stack); if (websocket) { await screenshot('failure').catch(() => {}); console.error(await evaluate(`({dialogs:Array.from(document.querySelectorAll('[role=dialog]')).map(e=>e.textContent.slice(0,400)),radios:Array.from(document.querySelectorAll('[role=radio]')).map(e=>e.outerHTML.slice(0,400))})`).catch(() => ({}))) }; process.exitCode = 1 }).finally(async () => {
  websocket?.close(); if (chrome) { chrome.kill(); await delay(1000) }
  if (calls.length) await db.setting.deleteMany({ where: { key: { in: calls.map((id) => 'lesson-call:' + id) } } })
  if (conversationId) await db.conversation.delete({ where: { id: conversationId } })
  if (bookings.length) { await db.payment.deleteMany({ where: { refId: { in: bookings } } }); await db.booking.deleteMany({ where: { id: { in: bookings } } }) }
  const ids = users.map((user) => user.id)
  if (ids.length) { await db.notification.deleteMany({ where: { userId: { in: ids } } }); await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.tutorProfile.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }) }
  await db.$disconnect()
  const resolved = path.resolve(profile); assert(resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('ui-test-'))
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  console.log('Isolated mobile test accounts and temporary browser profile removed')
})
