// Real backend: Supabase (Postgres + RLS, Auth, Storage, Edge Functions).
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'
import { ApiError, toApiError } from './errors.js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

const MEDIA_BUCKET = 'media'

async function run(promise) {
  const { data, error } = await promise
  if (error) throw toApiError(error)
  return data
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let payload = null
    try {
      payload = await error.context?.json?.()
    } catch {
      /* not JSON */
    }
    throw new ApiError(payload?.error || 'Could not reach the booking service. Please try again.', {
      hint: payload?.hint,
      cause: error,
    })
  }
  if (data?.error) throw new ApiError(data.error, { hint: data.hint })
  return data
}

// --------------------------------------------------------------- public ---
export const getBusiness = (slug) =>
  run(supabase.from('businesses').select('*').eq('slug', slug).single())

export const listServices = (businessId, { includeInactive = false } = {}) => {
  let q = supabase.from('services').select('*').eq('business_id', businessId)
  if (!includeInactive) q = q.eq('is_active', true)
  return run(q.order('sort_order').order('name'))
}

export const listStaff = (businessId, { includeInactive = false } = {}) => {
  let q = supabase.from('staff').select('*').eq('business_id', businessId)
  if (!includeInactive) q = q.eq('is_active', true)
  return run(q.order('sort_order').order('name'))
}

export const listSchedules = (businessId) =>
  run(
    supabase
      .from('staff_schedules')
      .select('id, staff_id, day_of_week, start_time, end_time, staff!inner(business_id)')
      .eq('staff.business_id', businessId)
      .order('day_of_week')
      .order('start_time'),
  ).then((rows) => rows.map(({ staff: _staff, ...r }) => r))

export const listGallery = (businessId) =>
  run(
    supabase
      .from('gallery_photos')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order')
      .order('created_at', { ascending: false }),
  )

export const listTestimonials = (businessId, { includeUnpublished = false } = {}) => {
  let q = supabase.from('testimonials').select('*').eq('business_id', businessId)
  if (!includeUnpublished) q = q.eq('is_published', true)
  return run(q.order('sort_order'))
}

export const getAvailableSlots = ({ businessId, serviceIds, date, staffId = null }) =>
  run(
    supabase.rpc('get_available_slots', {
      p_business_id: businessId,
      p_service_ids: serviceIds,
      p_date: date,
      p_staff_id: staffId,
    }),
  )

export const getAvailableDates = ({ businessId, serviceIds, from, to, staffId = null }) =>
  run(
    supabase.rpc('get_available_dates', {
      p_business_id: businessId,
      p_service_ids: serviceIds,
      p_from: from,
      p_to: to,
      p_staff_id: staffId,
    }),
  )

// Goes through the create-booking edge function, which re-checks the slot
// inside a transaction before inserting.
export const createBooking = (payload) => invoke('create-booking', payload).then((d) => d.booking)

export const lookupBooking = (reference, phone) =>
  run(supabase.rpc('get_booking_by_reference', { p_reference: reference, p_phone: phone }))

// ----------------------------------------------------------------- auth ---
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export const signInWithPassword = (email, password) =>
  run(supabase.auth.signInWithPassword({ email, password }))

export const signInWithFacebook = (redirectPath = '/my-bookings') =>
  run(
    supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}${redirectPath}`, scopes: 'email public_profile' },
    }),
  )

export const signInWithEmailLink = (email, redirectPath = '/my-bookings') =>
  run(supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}${redirectPath}` } }))

export async function signOut() {
  await supabase.auth.signOut()
}

export async function isAdmin(businessId) {
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return false
  const data = await run(
    supabase.from('admin_users').select('role').eq('business_id', businessId).eq('user_id', session.session.user.id).maybeSingle(),
  )
  return !!data
}

export const getMyBookings = () => run(supabase.rpc('get_my_bookings'))
export const cancelMyBooking = (bookingId) => run(supabase.rpc('cancel_my_booking', { p_booking_id: bookingId }))

// ---------------------------------------------------------------- admin ---
export const adminListBookings = ({ businessId, from, to, staffId = null, status = null }) =>
  run(
    supabase.rpc('admin_list_bookings', {
      p_business_id: businessId,
      p_from: from,
      p_to: to,
      p_staff_id: staffId,
      p_status: status,
    }),
  )

export const adminStats = (businessId) => run(supabase.rpc('admin_stats', { p_business_id: businessId }))

// Flipping to "confirmed" fires the DB trigger → send-confirmation edge function.
export const confirmPayment = (bookingId, referenceNote = null) =>
  run(supabase.rpc('admin_confirm_payment', { p_booking_id: bookingId, p_reference_note: referenceNote }))

export const setBookingStatus = (bookingId, status, reason = null) =>
  run(supabase.rpc('admin_set_booking_status', { p_booking_id: bookingId, p_status: status, p_reason: reason }))

export const resendConfirmation = (bookingId) => invoke('send-confirmation', { booking_id: bookingId, force: true })

async function save(table, row) {
  const { id, ...fields } = row
  if (id) return run(supabase.from(table).update(fields).eq('id', id).select().single())
  return run(supabase.from(table).insert(fields).select().single())
}
async function remove(table, id) {
  await run(supabase.from(table).delete().eq('id', id))
}

export const saveService = (service) => save('services', service)
export const deleteService = (id) => remove('services', id)
export const saveStaff = (staff) => save('staff', staff)
export const deleteStaff = (id) => remove('staff', id)
export const saveTestimonial = (t) => save('testimonials', t)
export const deleteTestimonial = (id) => remove('testimonials', id)

// One transaction on the server, so a failed save can't leave the staff
// member without working hours.
export const saveSchedules = (staffId, rows) =>
  run(
    supabase.rpc('admin_replace_staff_schedule', {
      p_staff_id: staffId,
      p_rows: rows.map((r) => ({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time })),
    }),
  )

export const listTimeOff = (businessId) =>
  run(
    supabase
      .from('staff_time_off')
      .select('id, staff_id, starts_at, ends_at, reason, staff!inner(business_id)')
      .eq('staff.business_id', businessId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at'),
  ).then((rows) => rows.map(({ staff: _staff, ...r }) => r))

export const addTimeOff = (row) => run(supabase.from('staff_time_off').insert(row).select().single())
export const deleteTimeOff = (id) => remove('staff_time_off', id)

export const updateBusiness = (id, fields) =>
  run(supabase.from('businesses').update(fields).eq('id', id).select().single())

export async function uploadImage(businessId, folder, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${businessId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  await run(supabase.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type }))
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

export async function removeImage(path) {
  if (!path) return
  await run(supabase.storage.from(MEDIA_BUCKET).remove([path]))
}

export const addGalleryPhoto = (row) => run(supabase.from('gallery_photos').insert(row).select().single())
export const updateGalleryPhoto = (id, fields) =>
  run(supabase.from('gallery_photos').update(fields).eq('id', id).select().single())
export async function deleteGalleryPhoto(photo) {
  await remove('gallery_photos', photo.id)
  if (photo.storage_path) await removeImage(photo.storage_path).catch(() => {})
}
