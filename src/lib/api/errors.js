// Errors thrown by the API carry a friendly `message` and, for booking
// problems, a machine-readable `hint` (e.g. "slot_unavailable").
export class ApiError extends Error {
  constructor(message, { hint, code, cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.hint = hint
    this.code = code
    this.cause = cause
  }
}

// Postgres errors whose message is safe and meant for end users.
const FRIENDLY_HINTS = new Set(['invalid_services', 'invalid_input', 'slot_unavailable', 'not_found', 'invalid_status', 'too_many_pending'])

export function toApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return new ApiError(fallback)
  if (err instanceof ApiError) return err
  const hint = err.hint || undefined
  const code = err.code || undefined
  if (FRIENDLY_HINTS.has(hint)) return new ApiError(err.message, { hint, code, cause: err })
  if (code === '42501' || /not authori[sz]ed|permission denied|row-level security/i.test(err.message || '')) {
    return new ApiError('You do not have permission to do that.', { code: '42501', cause: err })
  }
  return new ApiError(err.message || fallback, { hint, code, cause: err })
}
