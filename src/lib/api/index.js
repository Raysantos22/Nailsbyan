// Single data-access surface for the whole app. Two implementations share
// the same function names:
//   supabaseApi.js — the real backend (Supabase JS client + edge functions)
//   demoApi.js     — in-browser Postgres (PGlite) running the same SQL
//                    migrations, used when no Supabase project is configured
// Only the active implementation is downloaded.
import { DEMO_MODE } from '../config.js'

const implPromise = DEMO_MODE ? import('./demoApi.js') : import('./supabaseApi.js')

export const api = new Proxy(
  {},
  {
    get(_, name) {
      if (name === 'then' || typeof name === 'symbol') return undefined
      return async (...args) => {
        const impl = await implPromise
        if (typeof impl[name] !== 'function') throw new Error(`api.${String(name)} is not implemented`)
        return impl[name](...args)
      }
    },
  },
)

export { ApiError, toApiError } from './errors.js'
