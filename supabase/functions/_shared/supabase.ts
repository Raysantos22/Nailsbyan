import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing environment variable ${name}`)
  return v
}

// Service-role client: bypasses RLS. Only ever used server-side.
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function isServiceRoleToken(token: string | null): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return !!token && !!key && token === key
}

// Resolve a user JWT to a user, or null for anon/invalid tokens.
export async function userFromToken(client: SupabaseClient, token: string | null): Promise<User | null> {
  if (!token || token === Deno.env.get('SUPABASE_ANON_KEY') || token.startsWith('sb_publishable_')) return null
  try {
    const { data, error } = await client.auth.getUser(token)
    if (error) return null
    return data.user
  } catch {
    return null
  }
}
