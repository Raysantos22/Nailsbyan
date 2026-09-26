import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { BookingDetails, BusinessDetails } from './notifications/templates.ts'

export interface LoadedBooking {
  id: string
  status: string
  business_id: string
  details: BookingDetails
  business: BusinessDetails & { email?: string | null }
  customer: { name: string; email: string | null; phone: string | null; facebook_user_id: string | null }
}

// Load everything needed to message about a booking (service-role client).
export async function loadBooking(db: SupabaseClient, bookingId: string): Promise<LoadedBooking | null> {
  const { data, error } = await db
    .from('bookings')
    .select(
      `id, reference, status, business_id, start_time, end_time, total_price, notes,
       customer_name, customer_phone, customer_email,
       customer:customers(name, email, phone, facebook_user_id),
       staff:staff(name),
       business:businesses(name, address, phone, email, timezone, currency, facebook_page_url, messenger_id, cancellation_policy),
       lines:booking_services(service_name, price, position),
       payment:payments(amount_expected)`,
    )
    .eq('id', bookingId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  // deno-lint-ignore no-explicit-any
  const d = data as any
  const one = <T>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x)
  const customer = one(d.customer)
  const payment = one(d.payment)
  const lines = [...(d.lines ?? [])].sort((a, b) => a.position - b.position)

  return {
    id: d.id,
    status: d.status,
    business_id: d.business_id,
    business: one(d.business),
    // Contact details as entered for this booking (snapshot), not the shared customer row.
    customer: {
      name: d.customer_name,
      email: d.customer_email,
      phone: d.customer_phone,
      facebook_user_id: customer?.facebook_user_id ?? null,
    },
    details: {
      reference: d.reference,
      start_time: d.start_time,
      end_time: d.end_time,
      total_price: Number(d.total_price),
      services: lines.map((l) => ({ name: l.service_name, price: Number(l.price) })),
      staff_name: one(d.staff)?.name ?? null,
      customer_name: d.customer_name ?? 'there',
      customer_phone: d.customer_phone ?? null,
      customer_email: d.customer_email ?? null,
      notes: d.notes,
      deposit_amount: payment ? Number(payment.amount_expected) : null,
    },
  }
}
