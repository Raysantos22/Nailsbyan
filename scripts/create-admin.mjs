// Create (or promote) the salon owner's admin login.
// Usage: npm run create-admin   (reads .env.local)
// Needs VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD.
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export async function createAdmin({ url, serviceKey, email, password, slug = 'nails-by-an', role = 'owner' }) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: biz, error: bizErr } = await db.from('businesses').select('id, name').eq('slug', slug).single()
  if (bizErr) throw new Error(`Business "${slug}" not found — apply the migrations + seed first. (${bizErr.message})`)

  let userId
  const { data: created, error: createErr } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (created?.user) {
    userId = created.user.id
    console.log(`Created auth user ${email}`)
  } else {
    // Probably exists already — look it up.
    for (let page = 1; !userId; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
      if (data.users.length < 200) break
    }
    if (!userId) throw new Error(`Could not create or find ${email}: ${createErr?.message}`)
    console.log(`Using existing auth user ${email}`)
  }

  const { error } = await db
    .from('admin_users')
    .upsert({ user_id: userId, business_id: biz.id, role }, { onConflict: 'user_id,business_id' })
  if (error) throw error
  console.log(`✔ ${email} is now ${role} of ${biz.name}`)
  return { userId, businessId: biz.id }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, VITE_BUSINESS_SLUG } = process.env
  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD (see .env.example).')
    process.exit(1)
  }
  createAdmin({
    url: VITE_SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    slug: VITE_BUSINESS_SLUG || 'nails-by-an',
  }).catch((e) => {
    console.error('✖', e.message)
    process.exit(1)
  })
}
