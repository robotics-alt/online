// Local integration checks using isolated accounts; all fixtures are removed afterwards.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), https = require('node:https')
const { randomUUID, randomBytes, scryptSync } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
process.env.DATABASE_URL ||= 'file:' + path.resolve(__dirname, '../db/custom.db').replaceAll('\\', '/')
const db = new PrismaClient(), users = [], bookings = [], credits = []
const base = 'https://127.0.0.1:3443', ca = fs.readFileSync(path.resolve(__dirname, '../.local-https/ca.pem'))
const tag = 'approval-test-' + randomUUID(), password = randomUUID(), salt = randomBytes(16).toString('hex'), passwordHash = salt + ':' + scryptSync(password, salt, 64).toString('hex')
function request(url, cookie, json) { return new Promise((resolve, reject) => { const body = json === undefined ? undefined : JSON.stringify(json); const req = https.request(new URL(url, base), { method: body ? 'POST' : 'GET', ca, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (res) => { let text = ''; res.on('data', chunk => { text += chunk }); res.on('end', () => { let data; try { data = JSON.parse(text) } catch { data = text }; resolve({ status: res.statusCode, data, cookie: res.headers['set-cookie']?.[0]?.split(';')[0] }) }) }); req.on('error', reject); req.setTimeout(15000, () => req.destroy(new Error('Request timeout'))); req.end(body) }) }
async function account(role) { const user = await db.user.create({ data: { name: tag + role, email: randomUUID() + '@approval-test.invalid', role, status: 'ACTIVE', passwordHash, walletCents: 10000, ...(role === 'TUTOR' ? { tutorProfile: { create: { status: 'APPROVED', onlineEnabled: true, faceToFaceEnabled: true, hourlyRateCents: 2000 } } } : {}) }, include: { tutorProfile: true } }); users.push(user); const login = await request('/api/auth/login', null, { email: user.email, password }); assert.equal(login.status, 200); return { ...user, cookie: login.cookie } }
async function run() {
  const teacher = await account('TUTOR'), student = await account('STUDENT'), admin = await account('ADMIN'), outsider = await account('STUDENT')
  let slot = 0
  async function book(extra = {}, expected = 200) {
    const start = new Date(Date.now() + 3 * 86400000 + slot++ * 3600000).toISOString()
    const result = await request('/api/bookings', student.cookie, { tutorProfileId: teacher.tutorProfile.id, startUtc: start, durationMin: 60, paymentMethod: 'WALLET', ...extra })
    assert.equal(result.status, expected, JSON.stringify(result.data)); if (result.data.booking) bookings.push(result.data.booking.id); return result.data.booking
  }
  const trial = await book({ isTrial: true }); assert.equal(trial.status, 'CONFIRMED'); assert.equal(trial.priceCents, 0)
  assert.equal((await db.user.findUnique({ where: { id: student.id } })).walletCents, 10000)
  await book({ isTrial: true }, 400)
  await book({ lessonFormat: 'FACE_TO_FACE' }, 400)
  await book({ paymentMethod: 'NONE' }, 400)
  await book({ paymentMethod: 'BANK_TRANSFER' }, 400)
  const privateDetails = { phone: '+354 555 9911', email: tag + '@private.invalid', location: 'Private test location ' + tag, paymentReference: 'REF-' + tag }
  const pending = await book({ lessonFormat: 'FACE_TO_FACE', paymentMethod: 'BANK_TRANSFER', privateDetails })
  assert.equal(pending.status, 'PENDING_PAYMENT')
  const row = await db.booking.findUnique({ where: { id: pending.id } }), month = row.startUtc.toISOString().slice(0, 7)
  const calendar = () => request(`/api/tutor/calendar?month=${month}&timezone=UTC`, teacher.cookie)
  assert(!(await calendar()).data.bookings.some(item => item.id === pending.id))
  assert(!(await request('/api/bookings', teacher.cookie)).data.bookings.some(item => item.id === pending.id))
  for (const cookie of [teacher.cookie, student.cookie, outsider.cookie]) assert.equal((await request(`/api/admin/bookings/${pending.id}/approval`, cookie, { action: 'approve' })).status, 403)
  assert.equal((await request(`/api/classroom/${pending.id}/token`, student.cookie)).status, 400)
  const adminList = await request('/api/admin/bookings', admin.cookie)
  assert.equal(adminList.data.bookings.find(item => item.id === pending.id).privateDetails.location, privateDetails.location)
  assert.equal((await request(`/api/admin/bookings/${pending.id}/approval`, admin.cookie, { action: 'approve' })).status, 200)
  assert.equal((await request(`/api/admin/bookings/${pending.id}/approval`, admin.cookie, { action: 'approve' })).status, 409)
  assert((await calendar()).data.bookings.some(item => item.id === pending.id))
  for (const result of [await calendar(), await request('/api/bookings', teacher.cookie), await request(`/api/tutor/students/${student.id}/history`, teacher.cookie), await request('/api/bookings', student.cookie)]) {
    const json = JSON.stringify(result.data); for (const value of Object.values(privateDetails)) assert(!json.includes(value), 'Private contact details leaked')
  }
  assert.equal((await request(`/api/classroom/${pending.id}/token`, student.cookie)).status, 400)
  assert.equal((await request('/api/lesson-calls', teacher.cookie, { bookingId: pending.id })).status, 400)
  assert.equal((await db.payment.findFirst({ where: { refId: pending.id } })).status, 'SUCCEEDED')
  console.log('Free trials, pending approval visibility, admin-only payment approval, private contact fields and offline classroom restrictions passed')
  const walletBooking = await book(), balanceReserved = (await db.user.findUnique({ where: { id: student.id } })).walletCents
  assert(balanceReserved < 10000)
  assert.equal((await request(`/api/admin/bookings/${walletBooking.id}/approval`, admin.cookie, { action: 'reject' })).status, 200)
  assert.equal((await db.user.findUnique({ where: { id: student.id } })).walletCents, 10000)
  assert.equal((await request(`/api/admin/bookings/${walletBooking.id}/approval`, admin.cookie, { action: 'reject' })).status, 409)
  assert(!(await calendar()).data.bookings.some(item => item.id === walletBooking.id))
  const packageCredit = await db.lessonCredit.create({ data: { studentId: student.id, tutorId: teacher.id, total: 2, remaining: 2, note: tag } }); credits.push(packageCredit.id)
  const creditBooking = await book({ paymentMethod: 'CREDIT', creditId: packageCredit.id })
  assert.equal((await db.lessonCredit.findUnique({ where: { id: packageCredit.id } })).remaining, 1)
  assert.equal((await request(`/api/bookings/${creditBooking.id}/cancel`, student.cookie, { reason: 'Isolated test cancellation' })).status, 200)
  assert.equal((await db.lessonCredit.findUnique({ where: { id: packageCredit.id } })).remaining, 2)
  const online = await book({ paymentMethod: 'CASH' })
  assert.equal((await request('/api/lesson-calls', teacher.cookie, { bookingId: online.id })).status, 400)
  assert.equal((await request(`/api/admin/bookings/${online.id}/approval`, admin.cookie, { action: 'approve' })).status, 200)
  const confirmedOnline = (await request('/api/bookings', teacher.cookie)).data.bookings.find(item => item.id === online.id)
  assert.equal(confirmedOnline.status, 'CONFIRMED'); assert(confirmedOnline.approvedAt)
  await db.tutorProfile.update({ where: { id: teacher.tutorProfile.id }, data: { onlineEnabled: false } })
  await book({ lessonFormat: 'ONLINE' }, 400)
  const profile = await request(`/api/tutors/${teacher.tutorProfile.id}`, student.cookie)
  assert.equal(profile.data.tutor.onlineEnabled, false); assert.equal(profile.data.tutor.faceToFaceEnabled, true)
  console.log('Wallet reservation/rejection refunds, duplicate prevention, package cancellation, approved online bookings and teacher format preferences passed')
}
run().catch(error => { console.error(error.stack); process.exitCode = 1 }).finally(async () => {
  const ids = users.map(user => user.id)
  if (bookings.length) { await db.payment.deleteMany({ where: { refId: { in: bookings } } }); await db.booking.deleteMany({ where: { id: { in: bookings } } }) }
  await db.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { body: { contains: tag } }] } })
  if (ids.length) { await db.ledgerEntry.deleteMany({ where: { userId: { in: ids } } }); await db.lessonCredit.deleteMany({ where: { studentId: { in: ids } } }); await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.auditLog.deleteMany({ where: { actorId: { in: ids } } }); await db.tutorProfile.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }) }
  await db.$disconnect(); console.log('Isolated booking approval fixtures removed')
})
