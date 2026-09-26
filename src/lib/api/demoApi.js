// DEMO backend: a real Postgres (PGlite, compiled to WASM) running inside the
// browser with the exact same migrations + seed as Supabase. Booking rules,
// availability, conflict checks and expiry are therefore identical to
// production — only auth, file storage and outgoing messages are simulated.
// Data persists in IndexedDB per browser; "Reset demo data" in /admin wipes it.
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import stubsSql from './demo/supabase-stubs.sql?raw'
import seedSql from '../../../supabase/seed.sql?raw'
import { DEMO_ADMIN } from '../config.js'
import { ApiError, toApiError } from './errors.js'

const migrationFiles = import.meta.glob('../../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const DB_NAME = 'idb://nails-by-an-demo-v2'
const DEMO_ADMIN_ID = 'dddddddd-0000-4000-8000-000000000001'
const SESSION_KEY = 'nails-demo-session'

// Match PostgREST's JSON shapes: dates as strings, numerics as numbers.
const parsers = {
  1082: (v) => v, // date → "YYYY-MM-DD"
  1114: (v) => v, // timestamp
  1184: (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).toISOString(), // timestamptz
  1083: (v) => v, // time
  1700: (v) => (v === null ? null : Number(v)), // numeric
}

let dbPromise = null

async function openDb() {
  let db
  try {
    db = await PGlite.create(DB_NAME, { extensions: { btree_gist }, parsers })
  } catch (e) {
    console.warn('PGlite IndexedDB unavailable, using in-memory demo database', e)
    db = await PGlite.create({ extensions: { btree_gist }, parsers })
  }
  const { rows } = await db.query("select to_regclass('public.businesses') is not null as ready")
  if (!rows[0].ready) await initSchema(db)
  // Stale pending bookings get tidied on load (pg_cron's job in production).
  await db.query('select public.expire_unpaid_bookings()')
  await flush(db)
  return db
}

async function initSchema(db) {
  await db.exec(stubsSql)
  const files = Object.keys(migrationFiles).sort()
  for (const f of files) await db.exec(migrationFiles[f])
  await db.exec(seedSql)
  await db.query('insert into auth.users (id, email) values ($1, $2) on conflict do nothing', [DEMO_ADMIN_ID, DEMO_ADMIN.email])
  await db.query(
    `insert into public.admin_users (user_id, business_id, role)
     select $1, id, 'owner' from public.businesses on conflict do nothing`,
    [DEMO_ADMIN_ID],
  )
}

function getDb() {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

// Statements that change data must be flushed to IndexedDB straight away:
// PGlite does not persist on transaction commit, so a write followed by a
// page navigation would otherwise be lost.
const WRITE_SQL = /^\s*(insert|update|delete)\b|\b(create_booking|admin_confirm_payment|admin_set_booking_status|cancel_my_booking|expire_unpaid_bookings|admin_replace_staff_schedule)\(/i

async function flush(db) {
  try {
    await db.syncToFs()
  } catch (e) {
    console.warn('Demo database could not be saved to this browser', e)
  }
}

// Run a query with auth.uid() set to the demo session's user (if any).
async function q(sql, params = []) {
  const db = await getDb()
  let rows
  try {
    rows = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [currentSession()?.user.id ?? ''])
      const res = await tx.query(sql, params)
      return res.rows
    })
  } catch (e) {
    throw toApiError(e)
  }
  if (WRITE_SQL.test(sql)) await flush(db)
  return rows
}
const one = async (sql, params) => (await q(sql, params))[0] ?? null
const rpc = async (sql, params) => Object.values((await one(sql, params)) ?? {})[0] ?? null

const IDENT = /^[a-z_][a-z0-9_]*$/
function toParam(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) return JSON.stringify(v)
  return v === undefined ? null : v
}

async function save(table, row) {
  const { id, ...fields } = row
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined)
  keys.forEach((k) => {
    if (!IDENT.test(k)) throw new ApiError(`Invalid field ${k}`)
  })
  const values = keys.map((k) => toParam(fields[k]))
  if (id) {
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    return one(`update public.${table} set ${sets} where id = $1 returning *`, [id, ...values])
  }
  const cols = keys.join(', ')
  const ph = keys.map((_, i) => `$${i + 1}`).join(', ')
  return one(`insert into public.${table} (${cols}) values (${ph}) returning *`, values)
}

const remove = (table, id) => q(`delete from public.${table} where id = $1`, [id])

// --------------------------------------------------------------- public ---
export const getBusiness = (slug) => one('select * from public.businesses where slug = $1', [slug])

export const listServices = (businessId, { includeInactive = false } = {}) =>
  q(
    `select * from public.services where business_id = $1 ${includeInactive ? '' : 'and is_active'}
      order by sort_order, name`,
    [businessId],
  )

export const listStaff = (businessId, { includeInactive = false } = {}) =>
  q(
    `select * from public.staff where business_id = $1 ${includeInactive ? '' : 'and is_active'}
      order by sort_order, name`,
    [businessId],
  )

export const listSchedules = (businessId) =>
  q(
    `select ss.id, ss.staff_id, ss.day_of_week, to_char(ss.start_time, 'HH24:MI:SS') as start_time,
            to_char(ss.end_time, 'HH24:MI:SS') as end_time
       from public.staff_schedules ss join public.staff s on s.id = ss.staff_id
      where s.business_id = $1 order by ss.day_of_week, ss.start_time`,
    [businessId],
  )

export const listGallery = (businessId) =>
  q('select * from public.gallery_photos where business_id = $1 order by sort_order, created_at desc', [businessId])

export const listTestimonials = (businessId, { includeUnpublished = false } = {}) =>
  q(
    `select * from public.testimonials where business_id = $1 ${includeUnpublished ? '' : 'and is_published'}
      order by sort_order`,
    [businessId],
  )

export const getAvailableSlots = ({ businessId, serviceIds, date, staffId = null }) =>
  q('select * from public.get_available_slots($1, $2, $3, $4)', [businessId, serviceIds, date, staffId])

export const getAvailableDates = ({ businessId, serviceIds, from, to, staffId = null }) =>
  q('select * from public.get_available_dates($1, $2, $3, $4, $5)', [businessId, serviceIds, from, to, staffId])

// Same call the create-booking edge function makes with the service role.
export async function createBooking(payload) {
  const session = currentSession()
  return rpc('select public.create_booking($1, $2, $3, $4, $5, $6, $7, $8, $9) as booking', [
    payload.business_id,
    payload.service_ids,
    payload.start_time,
    payload.customer?.name,
    payload.customer?.phone,
    payload.customer?.email || null,
    payload.notes || null,
    payload.staff_id || null,
    session?.user.id ?? null,
  ])
}

export const lookupBooking = (reference, phone) =>
  rpc('select public.get_booking_by_reference($1, $2)', [reference, phone])

// ----------------------------------------------------------------- auth ---
const listeners = new Set()

function currentSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function setSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage blocked — session lasts for this page only */
  }
  listeners.forEach((cb) => cb(session))
}

export async function getSession() {
  return currentSession()
}

export function onAuthChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export async function signInWithPassword(email, password) {
  if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
    throw new ApiError(`Demo mode: sign in with ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`)
  }
  const session = { user: { id: DEMO_ADMIN_ID, email: DEMO_ADMIN.email }, demo: true }
  setSession(session)
  return { session }
}

export async function signInWithFacebook() {
  throw new ApiError('Facebook login is available once the site is connected to Supabase (not in demo mode).')
}

export async function signInWithEmailLink() {
  throw new ApiError('Email login links are available once the site is connected to Supabase (not in demo mode).')
}

export async function signOut() {
  setSession(null)
}

export async function isAdmin(businessId) {
  if (!currentSession()) return false
  return !!(await one('select public.is_business_admin($1) as ok', [businessId]))?.ok
}

export const getMyBookings = () => rpc('select public.get_my_bookings()')
export const cancelMyBooking = (bookingId) => rpc('select public.cancel_my_booking($1)', [bookingId])

// ---------------------------------------------------------------- admin ---
export const adminListBookings = ({ businessId, from, to, staffId = null, status = null }) =>
  rpc('select public.admin_list_bookings($1, $2, $3, $4, $5)', [businessId, from, to, staffId, status])

export const adminStats = (businessId) => rpc('select public.admin_stats($1)', [businessId])

// Production: the status change fires the send-confirmation edge function.
// Demo: record what would have been sent.
async function logDemoNotifications(bookingId) {
  const b = await one(
    `select c.email, c.phone from public.bookings b join public.customers c on c.id = b.customer_id where b.id = $1`,
    [bookingId],
  )
  const rows = [['email', b?.email], ['sms', b?.phone]].filter(([, to]) => to)
  for (const [channel, recipient] of rows) {
    await q(
      `insert into public.notifications_log (booking_id, channel, recipient, status, error)
       values ($1, $2, $3, 'skipped', 'Demo mode — no message actually sent')`,
      [bookingId, channel, recipient],
    )
  }
}

export async function confirmPayment(bookingId, referenceNote = null) {
  const result = await rpc('select public.admin_confirm_payment($1, $2)', [bookingId, referenceNote])
  await logDemoNotifications(bookingId)
  return result
}

export const setBookingStatus = (bookingId, status, reason = null) =>
  rpc('select public.admin_set_booking_status($1, $2, $3)', [bookingId, status, reason])

export async function resendConfirmation(bookingId) {
  await logDemoNotifications(bookingId)
  return { ok: true, demo: true }
}

export const saveService = (service) => save('services', service)
export const deleteService = (id) => remove('services', id)
export const saveStaff = (staff) => save('staff', staff)
export const deleteStaff = (id) => remove('staff', id)
export const saveTestimonial = (t) => save('testimonials', t)
export const deleteTestimonial = (id) => remove('testimonials', id)

export async function saveSchedules(staffId, rows) {
  await q('select public.admin_replace_staff_schedule($1, $2)', [
    staffId,
    JSON.stringify(rows.map((r) => ({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time }))),
  ])
}

export const listTimeOff = (businessId) =>
  q(
    `select t.* from public.staff_time_off t join public.staff s on s.id = t.staff_id
      where s.business_id = $1 and t.ends_at >= now() order by t.starts_at`,
    [businessId],
  )
export const addTimeOff = (row) => save('staff_time_off', row)
export const deleteTimeOff = (id) => remove('staff_time_off', id)

export const updateBusiness = (id, fields) => save('businesses', { id, ...fields })

// Demo "storage": keep the image inline as a data URL.
export function uploadImage(_businessId, _folder, file) {
  return new Promise((resolve, reject) => {
    if (file.size > 3 * 1024 * 1024) {
      reject(new ApiError('Demo mode stores images in your browser — please use an image under 3 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ url: reader.result, path: null })
    reader.onerror = () => reject(new ApiError('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
export async function removeImage() {}

export const addGalleryPhoto = (row) => save('gallery_photos', row)
export const updateGalleryPhoto = (id, fields) => save('gallery_photos', { id, ...fields })
export const deleteGalleryPhoto = (photo) => remove('gallery_photos', photo.id)

// Demo-only helper.
export async function resetDemoData() {
  const db = await getDb()
  await db.close()
  dbPromise = null
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('/pglite/' + DB_NAME.replace('idb://', ''))
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}
