// POST /functions/v1/create-booking
// Body: { business_id, service_ids[], start_time, staff_id?, customer: { name, phone, email? }, notes? }
//
// Guests call this with just the anon key; logged-in customers also send
// their JWT so the booking is linked to their account. The actual work —
// re-checking the slot inside a transaction with a per-staff lock, then
// inserting booking + lines + payment — happens in public.create_booking().
import { bearerToken, json, preflight, UUID_RE } from '../_shared/http.ts'
import { adminClient, userFromToken } from '../_shared/supabase.ts'
import { loadBooking } from '../_shared/bookings.ts'
import { notify } from '../_shared/notifications/index.ts'
import { newBookingOwnerMessage } from '../_shared/notifications/templates.ts'

const FRIENDLY = new Set(['invalid_services', 'invalid_input', 'slot_unavailable', 'not_found', 'too_many_pending'])

interface Payload {
  business_id?: unknown
  service_ids?: unknown
  start_time?: unknown
  staff_id?: unknown
  customer?: { name?: unknown; phone?: unknown; email?: unknown }
  notes?: unknown
}

function validate(p: Payload): string | null {
  if (typeof p.business_id !== 'string' || !UUID_RE.test(p.business_id)) return 'Invalid business.'
  if (!Array.isArray(p.service_ids) || p.service_ids.length === 0 || p.service_ids.length > 10) return 'Please choose at least one service.'
  if (!p.service_ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) return 'Invalid service selection.'
  if (typeof p.start_time !== 'string' || Number.isNaN(Date.parse(p.start_time))) return 'Please choose a time.'
  if (p.staff_id != null && (typeof p.staff_id !== 'string' || !UUID_RE.test(p.staff_id))) return 'Invalid staff member.'
  const c = p.customer
  if (!c || typeof c.name !== 'string' || typeof c.phone !== 'string') return 'Please enter your name and mobile number.'
  if (c.name.length > 100 || c.phone.length > 30) return 'Name or phone is too long.'
  if (c.email != null && (typeof c.email !== 'string' || c.email.length > 254)) return 'Please enter a valid email address.'
  if (p.notes != null && (typeof p.notes !== 'string' || p.notes.length > 1000)) return 'Notes are too long.'
  return null
}

// Tell the owner a booking is waiting for payment (optional, best effort).
async function notifyOwner(db: ReturnType<typeof adminClient>, bookingId: string) {
  const ownerEmail = Deno.env.get('OWNER_NOTIFY_EMAIL')
  const ownerPhone = Deno.env.get('OWNER_NOTIFY_PHONE')
  if (!ownerEmail && !ownerPhone) return
  const booking = await loadBooking(db, bookingId)
  if (!booking) return
  const siteUrl = Deno.env.get('SITE_URL')
  const message = newBookingOwnerMessage(booking.details, booking.business, siteUrl ? `${siteUrl.replace(/\/$/, '')}/admin` : undefined)
  const results = await notify({ name: booking.business.name, email: ownerEmail, phone: ownerPhone }, message, {
    skipChannels: new Set(['messenger']),
  })
  await db.from('notifications_log').insert(
    results.map((r) => ({ booking_id: bookingId, channel: r.channel, kind: 'owner_new_booking', recipient: r.recipient, status: r.status, error: r.error ?? null })),
  )
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const invalid = validate(payload)
  if (invalid) return json({ error: invalid, hint: 'invalid_input' }, 400)

  const db = adminClient()
  const user = await userFromToken(db, bearerToken(req))
  const facebookId = user?.identities?.find((i) => i.provider === 'facebook')?.id ?? null

  const { data, error } = await db.rpc('create_booking', {
    p_business_id: payload.business_id,
    p_service_ids: payload.service_ids,
    p_start: payload.start_time,
    p_customer_name: payload.customer!.name,
    p_customer_phone: payload.customer!.phone,
    p_customer_email: payload.customer!.email ?? null,
    p_notes: payload.notes ?? null,
    p_staff_id: payload.staff_id ?? null,
    p_auth_user_id: user?.id ?? null,
    p_facebook_user_id: facebookId,
  })

  if (error) {
    if (error.hint && FRIENDLY.has(error.hint)) {
      return json({ error: error.message, hint: error.hint }, error.hint === 'slot_unavailable' ? 409 : 400)
    }
    // Deadlock / serialization failure under heavy concurrency: ask to retry.
    if (error.code === '40P01' || error.code === '40001') {
      return json({ error: 'That time was just being booked by someone else. Please try again.', hint: 'slot_unavailable' }, 409)
    }
    console.error('create_booking failed', error)
    return json({ error: 'Sorry, we could not save your booking. Please try again or message us.' }, 500)
  }

  try {
    await notifyOwner(db, data.booking_id)
  } catch (e) {
    console.error('owner notification failed', e)
  }

  return json({ booking: data }, 201)
})
