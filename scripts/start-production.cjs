const path = require('node:path')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || /^(replace|tutorsphere-dev-secret)/i.test(process.env.SESSION_SECRET)) throw Error('Set SESSION_SECRET to a random secret of at least 32 characters')
if (!process.env.DATABASE_URL) throw Error('Set DATABASE_URL to the persistent database location')
process.argv = [process.argv[0], process.argv[1], process.env.APP_HOST || '0.0.0.0', '.next', process.env.PORT || '3000']
require('./start-local-stable.cjs')
