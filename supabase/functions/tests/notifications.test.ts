// Unit tests for the notification layer (no network — fetch is stubbed).
// Run: npx deno test --allow-env supabase/functions/tests/
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1'
import { toE164 } from '../_shared/notifications/phone.ts'
import { enabledProviders, notify } from '../_shared/notifications/index.ts'
import { facebookMessenger, resendEmail, twilioSms } from '../_shared/notifications/providers.ts'
import { bookingConfirmedMessage, newBookingOwnerMessage } from '../_shared/notifications/templates.ts'
import type { NotificationProvider } from '../_shared/notifications/types.ts'

const booking = {
  reference: 'AB12CD34',
  start_time: '2026-09-29T02:00:00Z', // 10:00 Manila
  end_time: '2026-09-29T03:30:00Z',
  total_price: 850,
  services: [
    { name: 'Gel Polish Manicure', price: 650 },
    { name: 'Nail Art', price: 200 },
  ],
  staff_name: 'An',
  customer_name: 'Maria <script>',
  customer_phone: '0917 123 4567',
  customer_email: 'maria@example.com',
  notes: 'Pink chrome',
  deposit_amount: 200,
}
const business = {
  name: 'Nails by An',
  address: '123 Sample St',
  timezone: 'Asia/Manila',
  currency: 'PHP',
  facebook_page_url: 'https://www.facebook.com/profile.php?id=61556891524730',
  messenger_id: '61556891524730',
  cancellation_policy: 'Free cancellation up to 24h before.',
}

Deno.test('toE164 normalises local and international numbers', () => {
  assertEquals(toE164('0917 123 4567', '63'), '+639171234567')
  assertEquals(toE164('+63 917 123 4567', '63'), '+639171234567')
  assertEquals(toE164('639171234567', '63'), '+639171234567')
  assertEquals(toE164('0063-917-123-4567', '63'), '+639171234567')
  assertEquals(toE164('9171234567', '63'), '+639171234567')
  assertEquals(toE164('+61 412 345 678', '63'), '+61412345678')
  assertEquals(toE164('12', '63'), null)
  assertEquals(toE164(null), null)
})

Deno.test('confirmation message shows local time, services, reference and escapes HTML', () => {
  const m = bookingConfirmedMessage(booking, business)
  assertStringIncludes(m.subject, 'Booking confirmed')
  assertStringIncludes(m.text, 'AB12CD34')
  assertStringIncludes(m.text, 'Tuesday, September 29, 10:00 AM–11:30 AM')
  assertStringIncludes(m.text, 'Gel Polish Manicure + Nail Art')
  assertStringIncludes(m.text, 'https://m.me/61556891524730')
  assert(m.html)
  assert(!m.html.includes('<script>'), 'customer name must be escaped')
  assertStringIncludes(m.html, 'Maria &lt;script&gt;')
  assertMatch(m.html, /₱850|PHP\s?850/)
})

Deno.test('owner message includes customer contact, deposit and admin link', () => {
  const m = newBookingOwnerMessage(booking, business, 'https://nails.example/admin')
  assertStringIncludes(m.text, '0917 123 4567')
  assertStringIncludes(m.text, 'https://nails.example/admin')
  assertMatch(m.text, /Awaiting (₱200|PHP\s?200) deposit/)
})

function fakeProvider(channel: 'email' | 'sms' | 'messenger', opts: { configured?: boolean; fail?: boolean } = {}) {
  const sent: string[] = []
  const p: NotificationProvider = {
    channel,
    isConfigured: () => opts.configured ?? true,
    addressFor: (r) => (channel === 'email' ? r.email ?? null : channel === 'sms' ? r.phone ?? null : r.messengerPsid ?? null),
    send: (address) => {
      if (opts.fail) return Promise.reject(new Error('boom'))
      sent.push(address)
      return Promise.resolve()
    },
  }
  return { p, sent }
}

Deno.test('notify sends on each channel, and reports skipped / failed without throwing', async () => {
  const email = fakeProvider('email')
  const sms = fakeProvider('sms', { fail: true })
  const messenger = fakeProvider('messenger')
  const results = await notify(
    { name: 'Maria', email: 'maria@example.com', phone: '+639171234567', messengerPsid: null },
    { subject: 's', text: 't' },
    { providers: [email.p, sms.p, messenger.p] },
  )
  assertEquals(email.sent, ['maria@example.com'])
  assertEquals(results.map((r) => [r.channel, r.status]), [
    ['email', 'sent'],
    ['sms', 'failed'],
    ['messenger', 'skipped'],
  ])
  assertEquals(results[1].error, 'boom')
})

Deno.test('notify skips unconfigured channels and already-sent channels', async () => {
  const email = fakeProvider('email', { configured: false })
  const sms = fakeProvider('sms')
  const results = await notify(
    { name: 'M', email: 'm@example.com', phone: '+639171234567' },
    { subject: 's', text: 't' },
    { providers: [email.p, sms.p], skipChannels: new Set(['sms']) },
  )
  assertEquals(results, [{ channel: 'email', recipient: 'm@example.com', status: 'skipped', error: 'Channel not configured' }])
  assertEquals(sms.sent, [])
})

Deno.test('enabledProviders honours NOTIFY_CHANNELS', () => {
  assertEquals(enabledProviders(undefined, 'email').map((p) => p.channel), ['email'])
  assertEquals(enabledProviders(undefined, 'sms, email').map((p) => p.channel), ['email', 'sms'])
})

Deno.test('Resend and Twilio providers send the right HTTP requests', async () => {
  Deno.env.set('RESEND_API_KEY', 're_test')
  Deno.env.set('RESEND_FROM', 'Nails by An <bookings@example.com>')
  Deno.env.set('TWILIO_ACCOUNT_SID', 'AC123')
  Deno.env.set('TWILIO_AUTH_TOKEN', 'tok')
  Deno.env.set('TWILIO_FROM', '+15550001111')
  const calls: { url: string; init: RequestInit }[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as typeof fetch
  try {
    assert(resendEmail.isConfigured())
    assert(twilioSms.isConfigured())
    assert(!facebookMessenger.isConfigured())
    await resendEmail.send('maria@example.com', { subject: 'Hi', text: 'Body', html: '<p>Body</p>' })
    await twilioSms.send('+639171234567', { subject: 'Hi', text: 'Body' })
  } finally {
    globalThis.fetch = realFetch
  }
  assertEquals(calls[0].url, 'https://api.resend.com/emails')
  assertEquals((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer re_test')
  const resendBody = JSON.parse(String(calls[0].init.body))
  assertEquals(resendBody.to, ['maria@example.com'])
  assertEquals(calls[1].url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json')
  const form = calls[1].init.body as URLSearchParams
  assertEquals(form.get('To'), '+639171234567')
  assertEquals(form.get('From'), '+15550001111')
})

Deno.test('provider errors surface the HTTP status', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => Promise.resolve(new Response('bad key', { status: 401 }))) as typeof fetch
  try {
    let message = ''
    try {
      await resendEmail.send('a@b.co', { subject: 's', text: 't' })
    } catch (e) {
      message = (e as Error).message
    }
    assertStringIncludes(message, 'Resend responded 401')
  } finally {
    globalThis.fetch = realFetch
  }
})
