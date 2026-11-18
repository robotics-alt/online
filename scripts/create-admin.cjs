require('@next/env').loadEnvConfig(require('node:path').resolve(__dirname, '..'))
const { randomBytes, scryptSync } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters)')
  if (await db.user.count({ where: { role: 'ADMIN' } })) throw Error('An administrator already exists; use the admin password-reset controls')
  const salt = randomBytes(16).toString('hex')
  await db.user.create({ data: { email, name: process.env.ADMIN_NAME || 'Administrator', role: 'ADMIN', emailVerified: true, passwordHash: salt + ':' + scryptSync(password, salt, 64).toString('hex'), notificationPrefs: { create: {} } } })
  console.log('Administrator created. Remove ADMIN_PASSWORD from the environment after setup.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
