// Integration check: creates one temporary, zero-cost classroom fixture and removes it in finally.
const assert = require('node:assert/strict')
const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { io } = require('socket.io-client')
process.env.DATABASE_URL ||= 'file:' + path.resolve(__dirname, '../db/custom.db').replaceAll('\\', '/')
const db = new PrismaClient()
const ca = fs.readFileSync(path.resolve(__dirname, '../.local-https/ca.pem'))
const base = process.env.CLASSROOM_TEST_URL || 'https://127.0.0.1:3443'
const cookies = []
const sockets = []
let fixture

function request(url, { method = 'GET', json, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url, base)
    const body = json === undefined ? undefined : JSON.stringify(json)
    const transport = target.protocol === 'https:' ? https : http
    const req = transport.request(target, { method, ca, headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('end', () => { let data; try { data = JSON.parse(text) } catch { data = text }; resolve({ status: response.statusCode, data, headers: response.headers }) })
    })
    req.setTimeout(60000, () => req.destroy(new Error('Request timed out')))
    req.on('error', reject)
    req.end(body)
  })
}
async function login(email) {
  const res = await request('/api/auth/login', { method: 'POST', json: { email, password: process.env.CLASSROOM_TEST_PASSWORD || 'Password123!' } })
  assert.equal(res.status, 200, `Sign-in failed for ${email}`)
  const cookie = res.headers['set-cookie'][0].split(';')[0]
  cookies.push(cookie)
  return cookie
}
async function connect() {
  const socket = io(base + '/?XTransformPort=3003', { path: '/', transports: ['websocket'], reconnection: false, ca, rejectUnauthorized: true })
  sockets.push(socket)
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 12000); socket.once('connect', () => { clearTimeout(timeout); resolve() }); socket.once('connect_error', (error) => { clearTimeout(timeout); reject(error) }) })
  return socket
}
function receive(socket, event) {
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`${event} relay timed out`)), 5000); socket.once(event, (data) => { clearTimeout(timer); resolve(data) }) })
}

async function run() {
  assert.equal((await request('/')).status, 200, 'HTTPS app failed')
  assert.equal((await request('http://localhost:3000')).status, 200, 'PC app failed')
  console.log('HTTPS certificate verified against the local CA; PC and phone app respond')
  const studentCookie = await login('student@tutorsphere.app')
  const tutorCookie = await login('sarah@tutorsphere.app')
  const outsiderCookie = await login('student2@tutorsphere.app')
  const student = await db.user.findUniqueOrThrow({ where: { email: 'student@tutorsphere.app' } })
  const tutor = await db.tutorProfile.findFirstOrThrow({ where: { user: { email: 'sarah@tutorsphere.app' } } })
  fixture = await db.booking.create({ data: {
    studentId: student.id, tutorId: tutor.userId, tutorProfileId: tutor.id,
    startUtc: new Date(Date.now() - 60000), endUtc: new Date(Date.now() + 29 * 60000), durationMin: 30,
    status: 'CONFIRMED', isTrial: true, priceCents: 0, roomId: 'local-test-' + randomUUID(), studentNotes: 'Temporary automated classroom verification',
  } })
  const tokenPath = `/api/classroom/${fixture.id}/token`
  const studentAccess = await request(tokenPath, { cookie: studentCookie })
  const tutorAccess = await request(tokenPath, { cookie: tutorCookie })
  assert.equal(studentAccess.status, 200)
  assert.equal(tutorAccess.status, 200)
  assert.equal(studentAccess.data.lessonLabel, 'Trial lesson')
  assert.equal(studentAccess.data.roomId, tutorAccess.data.roomId)
  assert.equal((await request(tokenPath, { cookie: outsiderCookie })).status, 403)
  assert.equal((await request(tokenPath)).status, 401)
  console.log('Trial classroom authorizes its student and teacher and rejects unrelated visitors')
  const studentSocket = await connect()
  const teacherSocket = await connect()
  const studentJoin = await studentSocket.timeout(5000).emitWithAck('join_lesson', { token: studentAccess.data.token })
  const teacherJoin = await teacherSocket.timeout(5000).emitWithAck('join_lesson', { token: tutorAccess.data.token })
  assert.equal(studentJoin.ok, true)
  assert.equal(teacherJoin.ok, true)
  assert.equal(teacherJoin.peers.length, 1)
  const chat = receive(studentSocket, 'lesson_chat')
  teacherSocket.emit('lesson_chat', { body: 'Local trial video chat check' })
  assert.equal((await chat).body, 'Local trial video chat check')
  const offer = receive(studentSocket, 'rtc_offer')
  teacherSocket.emit('rtc_offer', { toSocketId: studentSocket.id, sdp: { type: 'offer', sdp: 'verification-only' } })
  assert.equal((await offer).fromSocketId, teacherSocket.id)
  const answer = receive(teacherSocket, 'rtc_answer')
  studentSocket.emit('rtc_answer', { toSocketId: teacherSocket.id, sdp: { type: 'answer', sdp: 'verification-only' } })
  assert.equal((await answer).fromSocketId, studentSocket.id)
  const ice = receive(studentSocket, 'rtc_ice')
  teacherSocket.emit('rtc_ice', { toSocketId: studentSocket.id, candidate: { candidate: 'verification-only' } })
  assert.equal((await ice).fromSocketId, teacherSocket.id)
  console.log('Secure WebSocket joins, classroom chat, offer/answer and ICE signaling all pass')
  const upcoming = new Date(Date.now() + 2 * 3600000)
  await db.booking.update({ where: { id: fixture.id }, data: { startUtc: upcoming, endUtc: new Date(upcoming.getTime() + 30 * 60000) } })
  assert.equal((await request(tokenPath, { cookie: studentCookie })).status, 423)
  console.log('Scheduled classroom opening window remains enforced')
}

run().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(async () => {
  sockets.forEach((socket) => socket.disconnect())
  if (fixture) { await db.booking.delete({ where: { id: fixture.id } }); console.log('Temporary classroom fixture removed') }
  for (const cookie of cookies) await request('/api/auth/logout', { method: 'POST', cookie }).catch(() => {})
  await db.$disconnect()
})
