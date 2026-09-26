// POST /functions/v1/send-confirmation   Body: { booking_id, force? }
//
// Called by the bookings_notify_confirmed DB trigger (pg_net, sending the
// shared NOTIFY_WEBHOOK_SECRET) whenever a booking flips to "confirmed", and by the admin dashboard's
// "Resend confirmation" button (admin JWT, force = true).
// Sends via every enabled provider (email / SMS / Messenger) and logs each
// outcome in notifications_log. Without `force`, channels that already sent
// successfully are skipped, so retries never double-message the customer.
import { bearerToken, json, preflight, safeEqual, UUID_RE } from '../_shared/http.ts'
import { adminClient, isServiceRoleToken, userFromToken } from '../_shared/supabase.ts'
import { loadBooking } from '../_shared/bookings.ts'
import { notify, type Channel } from '../_shared/notifications/index.ts'
import { bookingConfirmedMessage } from '../_shared/notifications/templates.ts'

const KIND = 'booking_confirmed'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  let body: { booking_id?: unknown; force?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  if (typeof body.booking_id !== 'string' || !UUID_RE.test(body.booking_id)) return json({ error: 'booking_id required' }, 400)
  const bookingId = body.booking_id

  const db = adminClient()
  const booking = await loadBooking(db, bookingId)
  if (!booking) return json({ error: 'Booking not found' }, 404)

  // Authorise: the DB trigger (shared webhook secret), the service role, or
  // an admin of this business.
  const token = bearerToken(req)
  const webhookSecret = Deno.env.get('NOTIFY_WEBHOOK_SECRET')
  const fromTrigger = !!webhookSecret && safeEqual(req.headers.get('x-webhook-secret'), webhookSecret)
  if (!fromTrigger && !isServiceRoleToken(token)) {
    const user = await userFromToken(db, token)
    if (!user) return json({ error: 'Not authorised' }, 401)
    const { data: admin } = await db
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('business_id', booking.business_id)
      .maybeSingle()
    if (!admin) return json({ error: 'Not authorised' }, 403)
  }

  if (booking.status !== 'confirmed') {
    return json({ error: `Booking is ${booking.status}, not confirmed.` }, 409)
  }

  const skipChannels = new Set<Channel>()
  if (body.force !== true) {
    const { data: sent } = await db
      .from('notifications_log')
      .select('channel')
      .eq('booking_id', bookingId)
      .eq('kind', KIND)
      .eq('status', 'sent')
    for (const row of sent ?? []) skipChannels.add(row.channel as Channel)
  }

  const message = bookingConfirmedMessage(booking.details, booking.business)
  const results = await notify(
    { name: booking.customer.name, email: booking.customer.email, phone: booking.customer.phone, messengerPsid: null },
    message,
    { skipChannels },
  )

  if (results.length) {
    const { error } = await db.from('notifications_log').insert(
      results.map((r) => ({
        booking_id: bookingId,
        channel: r.channel,
        kind: KIND,
        recipient: r.recipient,
        status: r.status,
        error: r.error ?? null,
      })),
    )
    if (error) console.error('notifications_log insert failed', error)
  }

  return json({ ok: true, results })
})
