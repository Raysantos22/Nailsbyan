// Best-effort conversion of a locally-typed phone number to E.164 for SMS.
//   "0917 123 4567" + country 63 → "+639171234567"
//   "+63 917 123 4567"           → "+639171234567"
//   "639171234567"               → "+639171234567"
export function toE164(raw: string | null | undefined, defaultCountryCode = '63'): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = defaultCountryCode + digits.slice(1)
  } else if (!digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits
  }
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}
