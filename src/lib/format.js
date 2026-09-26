// Formatting helpers. All appointment times are shown in the business's
// timezone, whatever timezone the visitor's device is in.

export function formatMoney(amount, currency = 'PHP') {
  const n = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export function formatDuration(minutes) {
  const m = Number(minutes || 0)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr ${r} min` : `${h} hr`
}

export function formatTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
}

export function formatDate(iso, timeZone, opts = {}) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...opts,
  })
}

export function formatDateTime(iso, timeZone) {
  return `${formatDate(iso, timeZone)}, ${formatTime(iso, timeZone)}`
}

// "YYYY-MM-DD" for an instant, as seen in the given timezone.
export function localDateString(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function todayIn(timeZone) {
  return localDateString(new Date(), timeZone)
}

// Pure calendar arithmetic on "YYYY-MM-DD" strings (no timezone involved).
export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: d.getUTCDate(),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  }
}

// UTC offset (e.g. "+08:00") of a timezone at a given instant.
export function tzOffset(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at)
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT'
  const m = name.match(/GMT([+-]\d{2}):?(\d{2})?/)
  return m ? `${m[1]}:${m[2] || '00'}` : '+00:00'
}

// Local "YYYY-MM-DD" + "HH:MM" in a timezone → ISO instant.
export function zonedToIso(dateStr, time, timeZone) {
  const guess = new Date(`${dateStr}T${time}:00Z`)
  return new Date(`${dateStr}T${time}:00${tzOffset(timeZone, guess)}`).toISOString()
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function formatClock(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`
}

export const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-stone-200 text-stone-600',
  completed: 'bg-sky-100 text-sky-800',
  no_show: 'bg-red-100 text-red-700',
}

export const STATUS_LABELS = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

export function messengerLink(business, text) {
  const id = business?.messenger_id
  if (!id) return business?.facebook_page_url || null
  const base = `https://m.me/${encodeURIComponent(id)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function mapsEmbedUrl(address) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}

export function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function isPlaceholder(text) {
  return !text || /placeholder|to follow|example\.com|000 0000/i.test(text)
}
