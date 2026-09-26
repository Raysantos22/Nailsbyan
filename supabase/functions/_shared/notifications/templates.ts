import type { OutgoingMessage } from './types.ts'

export interface BookingDetails {
  reference: string
  start_time: string
  end_time: string
  total_price: number
  services: { name: string; price: number }[]
  staff_name: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  notes?: string | null
  deposit_amount?: number | null
}

export interface BusinessDetails {
  name: string
  address?: string | null
  phone?: string | null
  timezone: string
  currency: string
  facebook_page_url?: string | null
  messenger_id?: string | null
  cancellation_policy?: string | null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

export function when(start: string, end: string, timeZone: string) {
  const d = new Date(start)
  const date = d.toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' })
  const t = (x: string) => new Date(x).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${date}, ${t(start)}–${t(end)}`
}

function messengerUrl(b: BusinessDetails) {
  return b.messenger_id ? `https://m.me/${encodeURIComponent(b.messenger_id)}` : b.facebook_page_url ?? null
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fffaf7;font-family:Arial,Helvetica,sans-serif;color:#2d1c22">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #fbe4ea;border-radius:16px" cellspacing="0" cellpadding="0">
<tr><td style="background:#b0405f;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0;font-size:20px;font-weight:bold">${esc(title)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.5">${body}</td></tr>
</table></td></tr></table></body></html>`
}

function detailsTable(b: BookingDetails, biz: BusinessDetails) {
  const rows: [string, string][] = [
    ['Reference', `<strong style="font-family:monospace;letter-spacing:1px">${esc(b.reference)}</strong>`],
    ['When', esc(when(b.start_time, b.end_time, biz.timezone))],
    ['With', esc(b.staff_name ?? 'Our team')],
    ['Services', b.services.map((s) => `${esc(s.name)} (${esc(money(Number(s.price), biz.currency))})`).join('<br>')],
    ['Total', esc(money(Number(b.total_price), biz.currency))],
  ]
  if (biz.address) rows.push(['Where', esc(biz.address)])
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#78716c;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>`)
    .join('')}</table>`
}

// Sent to the customer when the owner confirms their payment.
export function bookingConfirmedMessage(b: BookingDetails, biz: BusinessDetails): OutgoingMessage {
  const whenText = when(b.start_time, b.end_time, biz.timezone)
  const m = messengerUrl(biz)
  const text =
    `Hi ${b.customer_name}! Your ${biz.name} booking is CONFIRMED: ` +
    `${b.services.map((s) => s.name).join(' + ')} on ${whenText}. Ref ${b.reference}. ` +
    (biz.address ? `See you at ${biz.address}. ` : 'See you soon! ') +
    (m ? `Need to change it? Message us: ${m}` : '')
  const html = shell(
    'Your booking is confirmed ✨',
    `<p>Hi ${esc(b.customer_name)},</p>
<p>Thank you — we've received your deposit and your appointment at <strong>${esc(biz.name)}</strong> is confirmed.</p>
${detailsTable(b, biz)}
${biz.cancellation_policy ? `<p style="font-size:13px;color:#78716c">${esc(biz.cancellation_policy)}</p>` : ''}
${m ? `<p><a href="${esc(m)}" style="display:inline-block;background:#0866FF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold">Message us on Messenger</a></p>` : ''}
<p>See you soon!<br>${esc(biz.name)}</p>`,
  )
  return { subject: `Booking confirmed — ${biz.name}, ${whenText}`, text: text.trim(), html }
}

// Sent to the owner when a new (pending) booking comes in.
export function newBookingOwnerMessage(b: BookingDetails, biz: BusinessDetails, adminUrl?: string): OutgoingMessage {
  const whenText = when(b.start_time, b.end_time, biz.timezone)
  const deposit = b.deposit_amount ? money(Number(b.deposit_amount), biz.currency) : null
  const text =
    `New booking ${b.reference}: ${b.customer_name} (${b.customer_phone ?? 'no phone'}) — ` +
    `${b.services.map((s) => s.name).join(' + ')} on ${whenText} with ${b.staff_name ?? 'any'}. ` +
    `${deposit ? `Awaiting ${deposit} deposit. ` : ''}${adminUrl ? `Confirm: ${adminUrl}` : ''}`
  const html = shell(
    `New booking: ${b.customer_name}`,
    `<p>A new booking is waiting for payment confirmation.</p>
${detailsTable(b, biz)}
<p style="font-size:14px">Customer: ${esc(b.customer_name)} · ${esc(b.customer_phone ?? '')}${b.customer_email ? ` · ${esc(b.customer_email)}` : ''}</p>
${b.notes ? `<p style="font-size:14px"><strong>Notes:</strong> ${esc(b.notes)}</p>` : ''}
${deposit ? `<p>Expected deposit: <strong>${esc(deposit)}</strong>. Check Messenger / your payment app, then confirm it in the dashboard.</p>` : ''}
${adminUrl ? `<p><a href="${esc(adminUrl)}" style="display:inline-block;background:#b0405f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:bold">Open dashboard</a></p>` : ''}`,
  )
  return { subject: `New booking ${b.reference} — ${b.customer_name}, ${whenText}`, text: text.trim(), html }
}
