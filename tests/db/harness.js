// Spins up an in-memory Postgres (PGlite) with the Supabase stubs, every
// migration in supabase/migrations (in order) and supabase/seed.sql.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

export const BUSINESS_ID = '11111111-1111-4111-8111-111111111111'
export const STAFF_AN = '33333333-0000-4000-8000-000000000001'
export const STAFF_2 = '33333333-0000-4000-8000-000000000002'
export const SVC = {
  classicMani: '22222222-0000-4000-8000-000000000001',
  gelMani: '22222222-0000-4000-8000-000000000002',
  footSpa: '22222222-0000-4000-8000-000000000005',
  softGel: '22222222-0000-4000-8000-000000000006',
  nailArt: '22222222-0000-4000-8000-000000000008',
  removal: '22222222-0000-4000-8000-000000000009',
}

export async function createDb({ seed = true } = {}) {
  const db = new PGlite({ extensions: { btree_gist } })
  await db.exec(read('src', 'lib', 'api', 'demo', 'supabase-stubs.sql'))
  const migrations = readdirSync(join(root, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of migrations) {
    try {
      await db.exec(read('supabase', 'migrations', file))
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${e.message}`)
    }
  }
  if (seed) await db.exec(read('tests', 'db', seed === 'real' ? '../../supabase/seed.sql' : 'fixture.sql'))
  return db
}

// Run fn as a given Postgres role / auth user, then reset to superuser.
export async function as(db, role, userId, fn) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ''])
  if (role) await db.exec(`set role ${role}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
  }
}

// The next local date (Asia/Manila) with the given weekday (0=Sun) that is
// at least `minDaysAhead` days away.
export function nextLocalDate(dow, minDaysAhead = 2) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = new Date(`${fmt.format(new Date())}T00:00:00Z`)
  for (let i = minDaysAhead; i < minDaysAhead + 8; i++) {
    const d = new Date(today.getTime() + i * 86400000)
    if (d.getUTCDay() === dow) return d.toISOString().slice(0, 10)
  }
  throw new Error('unreachable')
}

// Manila is UTC+8 with no DST.
export const manila = (date, hhmm) => new Date(`${date}T${hhmm}:00+08:00`).toISOString()
