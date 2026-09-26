// POST /functions/v1/expire-unpaid-bookings
// Fallback for projects without pg_cron: call this on a schedule (e.g. a
// Supabase scheduled function, GitHub Action or cron-job.org every 15 min)
// with either the service-role key as Bearer token or the CRON_SECRET in an
// "x-cron-secret" header. The migration already schedules the same SQL via
// pg_cron when it is available, so normally you don't need this.
import { bearerToken, json, preflight, safeEqual } from '../_shared/http.ts'
import { adminClient, isServiceRoleToken } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const cronSecret = Deno.env.get('CRON_SECRET')
  const authorised = isServiceRoleToken(bearerToken(req)) || (cronSecret && safeEqual(req.headers.get('x-cron-secret'), cronSecret))
  if (!authorised) return json({ error: 'Not authorised' }, 401)

  const { data, error } = await adminClient().rpc('expire_unpaid_bookings')
  if (error) {
    console.error('expire_unpaid_bookings failed', error)
    return json({ error: 'Failed to expire bookings' }, 500)
  }
  return json({ ok: true, cancelled: data })
})
