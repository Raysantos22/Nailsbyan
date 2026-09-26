// Runtime configuration from Vite env vars (see .env.example).
const env = import.meta.env

export const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || ''
export const BUSINESS_SLUG = env.VITE_BUSINESS_SLUG || 'nails-by-an'

// Demo mode runs the real SQL migrations in an in-browser Postgres (PGlite)
// so the site works end-to-end without a Supabase project. It turns on
// automatically when no Supabase URL is configured.
export const DEMO_MODE = env.VITE_DEMO_MODE === 'true' || !SUPABASE_URL

export const DEMO_ADMIN = { email: 'admin@demo.test', password: 'demo1234' }
