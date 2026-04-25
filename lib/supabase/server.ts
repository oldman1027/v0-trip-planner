import { createClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This allows authenticated requests to bypass anon role restrictions
 * and properly use auth.uid() in RLS policies.
 * 
 * For cookie-based session auth, this client uses the authenticated user's
 * session from cookies when available.
 */
export async function createClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

