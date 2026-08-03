import { db } from './src/db.ts'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'

const token = crypto.randomBytes(24).toString('hex')
const sess = JSON.stringify({
  cookie: {
    originalMaxAge: 604800000,
    expires: new Date(Date.now() + 604800000).toISOString(),
    httpOnly: true,
    path: '/',
  },
  userId: 'd7c3483e-a427-4453-961c-ba45d437963f',
})
await db.execute(
  sql`INSERT INTO "sessions" (sid, sess, expire) VALUES (${token}, ${sess}::json, ${new Date(Date.now() + 604800000)}) ON CONFLICT (sid) DO NOTHING`,
)
console.log('TOKEN=' + token)
process.exit(0)
