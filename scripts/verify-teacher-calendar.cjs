// Isolated integration checks. All users, lessons, calls, chats and time-off fixtures are removed in finally.
const assert = require('node:assert/strict')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID, randomBytes, scryptSync } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { io } = require('socket.io-client')
process.env.DATABASE_URL ||= 'file:' + path.resolve(__dirname, '../db/custom.db').replaceAll('\\', '/')
const db = new PrismaClient()
const ca = fs.readFileSync(path.resolve(__dirname, '../.local-https/ca.pem'))
const base = process.env.CLASSROOM_TEST_URL || 'https://127.0.0.1:3443'
const password = 'Test-' + randomUUID()
const salt = randomBytes(16).toString('hex')
const passwordHash = salt + ':' + scryptSync(password, salt, 64).toString('hex')
const users = [], sockets = [], bookingIds = [], callIds = [], gameRoomIds = []
function sourceModule(file) {
  const ts = require('typescript')
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const result = { exports: {} }; new Function('module', 'exports', 'require', code)(result, result.exports, require); return result.exports
}
const { chooseBoardStudent, mayWriteBoard } = sourceModule('src/lib/whiteboard-policy.ts')
const { mergeMessages } = sourceModule('src/lib/chat-messages.ts')
let conversationId
function request(url, { method = 'GET', json, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const body = json === undefined ? undefined : JSON.stringify(json)
    const req = https.request(new URL(url, base), { method, ca, headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
      let text = ''; res.setEncoding('utf8'); res.on('data', (value) => { text += value }); res.on('end', () => { let data; try { data = JSON.parse(text) } catch { data = text }; resolve({ status: res.statusCode, data, headers: res.headers }) })
    })
    req.setTimeout(60000, () => req.destroy(new Error('Request timed out'))); req.on('error', reject); req.end(body)
  })
}
async function user(role, name) {
  const created = await db.user.create({ data: { email: randomUUID() + '@calendar-test.invalid', name, passwordHash, role, status: 'ACTIVE', ...(role === 'TUTOR' ? { tutorProfile: { create: { status: 'APPROVED' } } } : {}) }, include: { tutorProfile: true } })
  users.push(created)
  const login = await request('/api/auth/login', { method: 'POST', json: { email: created.email, password } })
  assert.equal(login.status, 200)
  return { ...created, cookie: login.headers['set-cookie'][0].split(';')[0] }
}
async function socket() {
  const connection = io(base + '/?XTransformPort=3003', { path: '/', transports: ['websocket'], reconnection: false, ca, rejectUnauthorized: true })
  sockets.push(connection)
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Socket timed out')), 10000); connection.once('connect', () => { clearTimeout(timer); resolve() }); connection.once('connect_error', (err) => { clearTimeout(timer); reject(err) }) })
  return connection
}
function receive(connection, event) {
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(event + ' timed out')), 7000); connection.once(event, (data) => { clearTimeout(timer); resolve(data) }) })
}
async function startCall(bookingId, cookie) {
  const result = await request('/api/lesson-calls', { method: 'POST', json: { bookingId }, cookie })
  assert.equal(result.status, 200, JSON.stringify(result.data)); callIds.push(result.data.call.id); return result.data.call
}
async function join(call, account, connection) {
  const token = await request(`/api/classroom/${call.bookingId}/token?callId=${call.id}`, { cookie: account.cookie })
  assert.equal(token.status, 200, JSON.stringify(token.data))
  const ack = await connection.timeout(5000).emitWithAck('join_lesson', { token: token.data.token })
  assert.equal(ack.ok, true, JSON.stringify(ack)); return ack
}
async function run() {
  assert.throws(() => chooseBoardStudent([]))
  assert.equal(chooseBoardStudent(['one', 'one']), 'one')
  assert.throws(() => chooseBoardStudent(['one', 'two']))
  assert.equal(chooseBoardStudent(['one', 'two'], 'two'), 'two')
  assert.equal(mayWriteBoard('student', 'one', { locked: true, studentId: 'one' }), false)
  assert.equal(mayWriteBoard('student', 'two', { locked: false, studentId: 'one' }), false)
  assert.equal(mergeMessages([{ id: 'one', body: 'optimistic' }], [{ id: 'one', body: 'echo' }]).length, 1)
  const teacher = await user('TUTOR', 'Calendar test teacher')
  const student = await user('STUDENT', 'Calendar test student')
  const stranger = await user('STUDENT', 'Calendar test outsider')
  const otherTeacher = await user('TUTOR', 'Calendar test other teacher')
  const begins = new Date(Date.now() + 2 * 86400000)
  const fixture = await db.booking.create({ data: { studentId: student.id, tutorId: teacher.id, tutorProfileId: teacher.tutorProfile.id, startUtc: begins, endUtc: new Date(begins.getTime() + 30 * 60000), durationMin: 30, status: 'CONFIRMED', isTrial: true, roomId: 'test-' + randomUUID(), priceCents: 0 } })
  bookingIds.push(fixture.id)
  const past = await db.booking.create({ data: { studentId: student.id, tutorId: teacher.id, tutorProfileId: teacher.tutorProfile.id, startUtc: new Date(Date.now() - 3 * 86400000), endUtc: new Date(Date.now() - 3 * 86400000 + 30 * 60000), durationMin: 30, status: 'COMPLETED', roomId: 'test-' + randomUUID(), priceCents: 0 } })
  bookingIds.push(past.id)
  const month = begins.toISOString().slice(0, 7)
  const calendar = await request(`/api/tutor/calendar?month=${month}&timezone=UTC`, { cookie: teacher.cookie })
  assert.equal(calendar.status, 200); assert(calendar.data.bookings.some((item) => item.id === fixture.id)); assert(calendar.data.bookings.every((item) => item.tutorId === teacher.id))
  assert.equal((await request(`/api/tutor/calendar?month=${month}&timezone=Invalid/Zone`, { cookie: teacher.cookie })).status, 400)
  assert.equal((await request(`/api/tutor/calendar?month=${month}`, { cookie: student.cookie })).status, 403)
  const history = await request(`/api/tutor/students/${student.id}/history`, { cookie: teacher.cookie })
  assert.equal(history.status, 200); assert.equal(history.data.count, 2); assert.equal(history.data.completed, 1)
  assert.equal((await request(`/api/tutor/students/${student.id}/history`, { cookie: otherTeacher.cookie })).status, 404)
  console.log('Monthly calendar, timezone validation, ownership and lesson history passed')
  const range = { from: '2030-02-10', to: '2030-02-12' }
  for (let index = 0; index < 2; index++) assert.equal((await request('/api/tutor/availability', { method: 'PUT', json: { vacationRange: range }, cookie: teacher.cookie })).status, 200)
  assert.equal(await db.availabilityException.count({ where: { tutorId: teacher.tutorProfile.id, reason: 'Vacation' } }), 3)
  assert.equal((await request('/api/tutor/availability', { method: 'PUT', json: { vacationRange: { from: '2030-02-12', to: '2030-02-10' } }, cookie: teacher.cookie })).status, 400)
  console.log('Scheduled vacation dates and duplicate prevention passed')
  const tokenPath = `/api/classroom/${fixture.id}/token`
  assert.equal((await request(tokenPath, { cookie: teacher.cookie })).status, 423)
  assert.equal((await request('/api/lesson-calls', { method: 'POST', json: { bookingId: fixture.id }, cookie: student.cookie })).status, 403)
  assert.equal((await request('/api/lesson-calls', { method: 'POST', json: { bookingId: fixture.id }, cookie: otherTeacher.cookie })).status, 404)
  const unanswered = await startCall(fixture.id, teacher.cookie)
  assert.equal(Date.parse(unanswered.deadline) - Date.parse(unanswered.createdAt), 15 * 60000)
  assert.equal((await request('/api/lesson-calls', { cookie: student.cookie })).data.calls[0].id, unanswered.id)
  assert.equal((await request('/api/lesson-calls', { cookie: stranger.cookie })).data.calls.length, 0)
  assert.equal((await request(`/api/lesson-calls/${unanswered.id}`, { cookie: stranger.cookie })).status, 404)
  assert.equal((await request(`/api/lesson-calls/${unanswered.id}`, { method: 'PATCH', json: { action: 'accept' }, cookie: teacher.cookie })).status, 403)
  const waitingTeacher = await socket(); await join(unanswered, teacher, waitingTeacher)
  const expiryEvent = receive(waitingTeacher, 'call_ended')
  await db.setting.update({ where: { key: 'lesson-call:' + unanswered.id }, data: { value: JSON.stringify({ ...unanswered, deadline: new Date(Date.now() - 1000).toISOString() }) } })
  assert.equal((await expiryEvent).reason, 'no_answer')
  assert.equal((await request(`${tokenPath}?callId=${unanswered.id}`, { cookie: student.cookie })).status, 410)
  assert.equal((await request(`/api/lesson-calls/${unanswered.id}/feedback`, { cookie: student.cookie })).data.eligible, false)
  assert.equal((await db.booking.findUnique({ where: { id: fixture.id } })).status, 'CONFIRMED')
  console.log('Early invitations, authorization, exact 15-minute deadline and server-enforced no-answer closure passed')
  const answered = await startCall(fixture.id, teacher.cookie)
  const teacherSocket = await socket(); await join(answered, teacher, teacherSocket)
  assert.equal((await request(`/api/lesson-calls/${answered.id}`, { method: 'PATCH', json: { action: 'accept' }, cookie: student.cookie })).status, 200)
  const studentSocket = await socket(); const studentJoin = await join(answered, student, studentSocket)
  assert.equal(studentJoin.call.status, 'active'); assert(studentJoin.call.studentJoinedAt)
  assert.deepEqual(studentJoin.boardAccess, { locked: true, studentId: null })
  const boardEvents = []
  teacherSocket.on('wb_stroke', (event) => boardEvents.push(event))
  studentSocket.emit('wb_stroke', { stroke: { id: 'blocked',tool:'pen',color:'#6557d8',width:3,points:[[.1,.1],[.2,.2]] } })
  assert.equal((await studentSocket.timeout(5000).emitWithAck('wb_access', { locked: false })).ok, false)
  await new Promise((resolve) => setTimeout(resolve, 150)); assert.equal(boardEvents.length, 0)
  const unlocked = receive(studentSocket, 'wb_access')
  assert.equal((await teacherSocket.timeout(5000).emitWithAck('wb_access', { locked: false })).ok, true)
  assert.deepEqual(await unlocked, { locked: false, studentId: student.id })
  const drawing = receive(teacherSocket, 'wb_stroke')
  studentSocket.emit('wb_stroke', { stroke: { id: 'allowed',tool:'pen',color:'#6557d8',width:3,points:[[.1,.1],[.2,.2]] } }); assert.equal((await drawing).stroke.id, 'allowed')
  assert.equal((await teacherSocket.timeout(5000).emitWithAck('wb_access', { locked: true })).ok, true)
  studentSocket.emit('wb_stroke', { stroke: { id: 'blocked-again',tool:'pen',color:'#6557d8',width:3,points:[[.1,.1],[.2,.2]] } })
  await studentSocket.timeout(5000).emitWithAck('wb_access', { locked: false })
  await new Promise((resolve) => setTimeout(resolve, 150)); assert.equal(boardEvents.length, 1)
  let chatCount = 0; teacherSocket.on('lesson_chat', () => { chatCount++ })
  studentSocket.emit('lesson_chat', { body: 'Unique chat', clientId: 'same-send' })
  studentSocket.emit('lesson_chat', { body: 'Unique chat', clientId: 'same-send' })
  await studentSocket.timeout(5000).emitWithAck('wb_access', { locked: false })
  await new Promise((resolve) => setTimeout(resolve, 150)); assert.equal(chatCount, 1)
  console.log('Server-enforced board locking, automatic single-student unlock, group selection policy and chat deduplication passed')
  assert.equal((await request('/api/games/open-room', { method: 'POST', json: { gameSlug: 'tic-tac-toe' }, cookie: student.cookie })).status, 403)
  assert.equal((await request('/api/games/invitations', { method: 'POST', json: { action: 'create', toUserId: teacher.id, gameSlug: 'tic-tac-toe' }, cookie: student.cookie })).status, 403)
  assert.equal((await request('/api/games', { method: 'POST', json: { action: 'solo-result', gameSlug: 'tic-tac-toe' }, cookie: student.cookie })).status, 403)
  const gameInvite = await request('/api/games/invitations', { method: 'POST', json: { action: 'create', toUserId: student.id, gameSlug: 'tic-tac-toe' }, cookie: teacher.cookie })
  assert.equal(gameInvite.status, 200, JSON.stringify(gameInvite.data))
  const gameRoom = await db.gameRoom.findUnique({ where: { code: gameInvite.data.roomCode } }); gameRoomIds.push(gameRoom.id)
  const gameToken = (await request('/api/games', { method: 'POST', json: { action: 'token' }, cookie: student.cookie })).data.token
  assert.equal((await studentSocket.timeout(5000).emitWithAck('game:join', { token: gameToken, roomCode: gameInvite.data.roomCode })).ok, false)
  assert.equal((await request('/api/games/invitations', { method: 'POST', json: { action: 'accept', invitationId: gameInvite.data.invitationId }, cookie: student.cookie })).status, 200)
  assert.equal((await studentSocket.timeout(5000).emitWithAck('game:join', { token: gameToken, roomCode: gameInvite.data.roomCode })).ok, true)
  console.log('Student game restrictions and teacher invitation acceptance passed')
  const joinedAt = new Date(Date.now() - 10000).toISOString()
  await db.setting.update({ where: { key: 'lesson-call:' + answered.id }, data: { value: JSON.stringify({ ...studentJoin.call, studentJoinedAt: joinedAt, teacherJoinedAt: joinedAt, deadline: new Date(Date.now() - 1000).toISOString() }) } })
  assert.equal((await request(`/api/lesson-calls/${answered.id}`, { cookie: student.cookie })).data.call.status, 'active')
  const chat = receive(studentSocket, 'lesson_chat'); teacherSocket.emit('lesson_chat', { body: 'Early lesson call test' }); assert.equal((await chat).body, 'Early lesson call test')
  const offer = receive(studentSocket, 'rtc_offer'); teacherSocket.emit('rtc_offer', { toSocketId: studentSocket.id, sdp: { type: 'offer', sdp: 'test' } }); assert.equal((await offer).fromSocketId, teacherSocket.id)
  const hangup = receive(studentSocket, 'call_ended')
  assert.equal((await request(`/api/lesson-calls/${answered.id}`, { method: 'PATCH', json: { action: 'end' }, cookie: teacher.cookie })).status, 200)
  assert.equal((await hangup).reason, 'hangup')
  const feedback = await request(`/api/lesson-calls/${answered.id}/feedback`, { cookie: student.cookie })
  assert.equal(feedback.data.eligible, true); assert(feedback.data.durationSeconds >= 10); assert.equal(feedback.data.tutorName, teacher.name)
  assert.equal((await request(`/api/lesson-calls/${answered.id}/feedback`, { cookie: stranger.cookie })).status, 404)
  const reviewPayload = { bookingId: fixture.id, callId: answered.id, rating: 5, comment: 'Isolated call feedback test' }
  assert.equal((await request('/api/reviews', { method: 'POST', json: reviewPayload, cookie: stranger.cookie })).status, 403)
  assert.equal((await request('/api/reviews', { method: 'POST', json: reviewPayload, cookie: student.cookie })).status, 200)
  assert.equal((await request('/api/reviews', { method: 'POST', json: reviewPayload, cookie: student.cookie })).status, 409)
  assert.equal((await request(`/api/lesson-calls/${answered.id}/feedback`, { cookie: student.cookie })).data.eligible, false)
  console.log('Post-call duration, review eligibility, ownership and duplicate review prevention passed')
  const declined = await startCall(fixture.id, teacher.cookie)
  assert.equal((await request(`/api/lesson-calls/${declined.id}`, { method: 'PATCH', json: { action: 'decline' }, cookie: student.cookie })).data.call.endReason, 'declined')
  console.log('Student answer, shared early classroom, video signaling, hangup and decline passed')
  const conversation = await request('/api/conversations', { method: 'POST', json: { userId: student.id }, cookie: teacher.cookie })
  conversationId = conversation.data.conversationId
  const teacherMessages = await request('/api/conversations/' + conversationId, { cookie: teacher.cookie })
  const studentMessages = await request('/api/conversations/' + conversationId, { cookie: student.cookie })
  assert.equal((await teacherSocket.timeout(5000).emitWithAck('join_conversation', { conversationId, token: teacherMessages.data.socketToken })).ok, true)
  assert.equal((await studentSocket.timeout(5000).emitWithAck('join_conversation', { conversationId, token: studentMessages.data.socketToken })).ok, true)
  const wrong = await waitingTeacher.timeout(5000).emitWithAck('join_conversation', { conversationId: 'wrong-conversation', token: teacherMessages.data.socketToken }); assert.equal(wrong.ok, false)
  const sent = await request('/api/conversations/' + conversationId, { method: 'POST', json: { body: 'Embedded dashboard chat test' }, cookie: teacher.cookie })
  const incoming = receive(studentSocket, 'message'); teacherSocket.emit('message_relay', { conversationId, message: { id: sent.data.message.id } })
  const delivered = await incoming; assert.equal(delivered.conversationId, conversationId); assert.equal(delivered.message.body, 'Embedded dashboard chat test')
  console.log('Signed conversation joins and persisted realtime dashboard messaging passed')
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 }).finally(async () => {
  sockets.forEach((connection) => connection.disconnect())
  if (gameRoomIds.length) { await db.gameInvitation.deleteMany({ where: { roomId: { in: gameRoomIds } } }); await db.gameRoom.deleteMany({ where: { id: { in: gameRoomIds } } }) }
  if (callIds.length) await db.setting.deleteMany({ where: { key: { in: callIds.map((id) => 'lesson-call:' + id) } } })
  if (conversationId) { await db.message.deleteMany({ where: { conversationId } }); await db.conversation.delete({ where: { id: conversationId } }) }
  if (bookingIds.length) { await db.review.deleteMany({ where: { bookingId: { in: bookingIds } } }); await db.booking.deleteMany({ where: { id: { in: bookingIds } } }) }
  const ids = users.map((item) => item.id)
  if (ids.length) {
    await db.notification.deleteMany({ where: { userId: { in: ids } } }); await db.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.tutorProfile.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.$disconnect(); console.log('Isolated verification fixtures removed')
})
