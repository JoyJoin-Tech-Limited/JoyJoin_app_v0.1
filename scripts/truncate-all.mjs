import pg from 'pg'
import { readFileSync } from 'fs'

const envContent = readFileSync(new URL('../.env', import.meta.url), 'utf-8')
const match = envContent.match(/^DATABASE_URL='(.+)'$/m)
if (!match) throw new Error('DATABASE_URL not found in .env')
const DATABASE_URL = match[1]

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  console.log('Connected to database.')

  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
    ORDER BY tablename
  `)

  const tables = res.rows.map(r => r.tablename)
  console.log(`Found ${tables.length} tables to truncate:`)
  tables.forEach(t => console.log(`  - ${t}`))

  if (tables.length > 0) {
    await client.query('SET session_replication_role = replica')
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE`)
    }
    await client.query('SET session_replication_role = origin')
  }

  console.log('All tables truncated successfully.')
  await client.end()
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
