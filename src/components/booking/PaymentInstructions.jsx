import { CalendarPlus, Clock, Copy, Check, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { formatDateTime, formatDuration, formatMoney, formatTime, messengerLink } from '../../lib/format.js'
import { StatusBadge } from '../ui.jsx'

function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function downloadIcs(booking, business) {
  const escape = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nails by An//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.booking_id}@nails-booking`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(booking.start_time)}`,
    `DTEND:${icsDate(booking.end_time)}`,
    `SUMMARY:${escape(`${business.name}: ${booking.services.map((s) => s.name).join(', ')}`)}`,
    `LOCATION:${escape(business.address)}`,
    `DESCRIPTION:${escape(`Booking reference ${booking.reference}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `booking-${booking.reference}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BookingSummary({ booking, business }) {
  const tz = business.timezone
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-stone-500">Reference</dt>
      <dd className="font-mono font-semibold tracking-wider" data-testid="booking-reference">
        {booking.reference}
      </dd>
      <dt className="text-stone-500">Status</dt>
      <dd>
        <StatusBadge status={booking.status} />
      </dd>
      <dt className="text-stone-500">When</dt>
      <dd className="font-medium">
        {formatDateTime(booking.start_time, tz)} – {formatTime(booking.end_time, tz)}
      </dd>
      <dt className="text-stone-500">With</dt>
      <dd>{booking.staff_name || 'Any available'}</dd>
      <dt className="text-stone-500">Services</dt>
      <dd>
        <ul>
          {booking.services.map((s) => (
            <li key={s.service_id || s.name}>
              {s.name} <span className="text-stone-500">· {formatMoney(s.price, booking.currency)}</span>
            </li>
          ))}
        </ul>
      </dd>
      <dt className="text-stone-500">Total</dt>
      <dd className="font-semibold">
        {formatMoney(booking.total_price, booking.currency)}{' '}
        <span className="font-normal text-stone-500">· {formatDuration(booking.total_duration)}</span>
      </dd>
    </dl>
  )
}

// Shown after booking (and when a guest looks their booking up): the QR
// code, how much to send, and how to send proof via Messenger.
export default function PaymentInstructions({ booking, business }) {
  const [copied, setCopied] = useState(false)
  const deposit = Number(booking.deposit_amount || 0)
  const pending = booking.status === 'pending'
  const tz = business.timezone
  const msgText = `Hi! I just booked ${booking.services.map((s) => s.name).join(' + ')} on ${formatDateTime(booking.start_time, tz)}. Booking ref: ${booking.reference}. Here is my payment screenshot:`
  const mLink = messengerLink(business, msgText)

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(booking.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <BookingSummary booking={booking} business={business} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={copyRef}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy reference'}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => downloadIcs(booking, business)}>
            <CalendarPlus className="h-4 w-4" /> Add to calendar
          </button>
        </div>
      </div>

      {pending && (
        <div className="card overflow-hidden" data-testid="payment-instructions">
          <div className="bg-brand-600 px-5 py-4 text-white sm:px-6">
            <h2 className="font-sans text-lg font-semibold">
              {deposit > 0 ? `Pay your ${formatMoney(deposit, booking.currency)} deposit to secure your slot` : 'Send your payment to secure your slot'}
            </h2>
            {booking.expires_at && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-50">
                <Clock className="h-4 w-4" aria-hidden="true" /> We hold this slot until {formatDateTime(booking.expires_at, tz)}.
              </p>
            )}
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
            <div className="mx-auto w-full max-w-[220px]">
              {business.payment_qr_url ? (
                <img
                  src={business.payment_qr_url}
                  alt={`${business.payment_method_label || 'Payment'} QR code`}
                  className="w-full rounded-xl border border-brand-100 bg-white p-2"
                  data-testid="payment-qr"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-brand-200 p-4 text-center text-xs text-stone-500">
                  Payment QR code coming soon — message us for payment details.
                </div>
              )}
              {business.payment_method_label && (
                <p className="mt-2 text-center text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  {business.payment_method_label}
                </p>
              )}
            </div>
            <div className="space-y-4 text-sm">
              <ol className="list-decimal space-y-2 pl-5 text-stone-700">
                <li>
                  Scan the QR code with your {business.payment_method_label || 'banking'} app and send{' '}
                  <strong>{deposit > 0 ? formatMoney(deposit, booking.currency) : 'your payment'}</strong>.
                </li>
                <li>Take a screenshot of the payment (or copy the reference number).</li>
                <li>
                  Send it to us on Facebook Messenger with your booking reference{' '}
                  <strong className="font-mono">{booking.reference}</strong>.
                </li>
                <li>We&apos;ll confirm your booking once we see your payment.</li>
              </ol>
              {business.payment_instructions && <p className="text-stone-600">{business.payment_instructions}</p>}
              {mLink && (
                <a href={mLink} target="_blank" rel="noreferrer" className="btn w-full bg-[#0866FF] text-white hover:bg-[#0756d6] sm:w-auto">
                  <MessageCircle className="h-4 w-4" /> Send payment proof on Messenger
                </a>
              )}
              <p className="text-xs text-stone-500">
                Unpaid bookings are released automatically after the hold time so others can book.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
