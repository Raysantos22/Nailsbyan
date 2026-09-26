// Local dev/testing seed: makes sure the admin login exists and adds a few
// sample bookings (pending + confirmed) over the coming days, using the same
// create_booking() function the website uses, so every booking rule applies.
//
// Usage: npm run seed:dev   (reads .env.local; run AFTER `supabase db reset`,
// which applies supabase/migrations + supabase/seed.sql)
// Adds FAKE customers/bookings — refuses to run against *.supabase.co unless
// ALLOW_REMOTE_SEED=true (for a staging project).
import { createClient } from '@supabase/supabase-js'
import { createAdmin } from './create-admin.mjs'

const { VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, ADMIN_EMAIL, ADMIN_PASSWORD, VITE_BUSINESS_SLUG } = process.env
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example).')
  process.exit(1)
}
if (/supabase\.co/.test(url) && process.env.ALLOW_REMOTE_SEED !== 'true') {
  console.error('Refusing to add fake bookings to a hosted project. Set ALLOW_REMOTE_SEED=true if this is a staging project.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const slug = VITE_BUSINESS_SLUG || 'nails-by-an'

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  await createAdmin({ url, serviceKey: key, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, slug })
}

const { data: biz, error: bizErr } = await db.from('businesses').select('*').eq('slug', slug).single()
if (bizErr) throw bizErr
const { data: services } = await db
  .from('services')
  .select('*')
  .eq('business_id', biz.id)
  .eq('is_active', true)
  .order('sort_order')
const mains = services.filter((s) => !s.is_addon)
const addons = services.filter((s) => s.is_addon && !s.parent_service_id)

const today = new Intl.DateTimeFormat('en-CA', { timeZone: biz.timezone }).format(new Date())
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

const customers = [
  ['Sample Maria Santos', '0917 100 0001', 'maria@example.com'],
  ['Sample Jasmine Cruz', '0917 100 0002', null],
  ['Sample Bea Reyes', '0917 100 0003', 'bea@example.com'],
  ['Sample Kim Garcia', '0917 100 0004', null],
  ['Sample Ella Mendoza', '0917 100 0005', 'ella@example.com'],
  ['Sample Rica Lim', '0917 100 0006', null],
]

let made = 0
for (let i = 0; i < customers.length; i++) {
  const [name, phone, email] = customers[i]
  const serviceIds = [mains[i % mains.length].id, ...(i % 2 && addons.length ? [addons[i % addons.length].id] : [])]
  for (let d = 1 + (i % 4); d < 20; d++) {
    const { data: slots, error } = await db.rpc('get_available_slots', {
      p_business_id: biz.id,
      p_service_ids: serviceIds,
      p_date: addDays(today, d),
      p_staff_id: null,
    })
    if (error) throw error
    if (!slots.length) continue
    const slot = slots[(i * 3) % slots.length]
    const { data: booking, error: bErr } = await db.rpc('create_booking', {
      p_business_id: biz.id,
      p_service_ids: serviceIds,
      p_start: slot.slot_start,
      p_customer_name: name,
      p_customer_phone: phone,
      p_customer_email: email,
      p_notes: i === 0 ? 'Sample booking from seed-dev' : null,
    })
    if (bErr) throw bErr
    // Confirm every other booking, as if the deposit had arrived.
    if (i % 2 === 0) {
      const now = new Date().toISOString()
      await db.from('bookings').update({ status: 'confirmed', confirmed_at: now }).eq('id', booking.booking_id)
      await db.from('payments').update({ status: 'received', received_at: now, reference_note: 'seed' }).eq('booking_id', booking.booking_id)
    }
    const when = new Date(slot.slot_start).toLocaleString('en-US', { timeZone: biz.timezone })
    console.log(`✔ ${booking.reference} ${name} — ${when} (${i % 2 === 0 ? 'confirmed' : 'pending'})`)
    made++
    break
  }
}
console.log(`Done: ${made} sample bookings.`)
