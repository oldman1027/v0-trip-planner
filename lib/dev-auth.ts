// AUTH DISABLED FOR DEV
// This file provides automatic sign-in for the demo user to bypass auth during development.
// To re-enable proper authentication:
//   1. Remove this entire file
//   2. Delete the auto-signin call from middleware.ts
//   3. Restore /login route UI and sign-in/sign-out buttons in components
//   4. Update middleware to redirect unauthenticated users to /login
//   5. Re-enable Supabase magic link auth in login-form.tsx

const DEMO_USER_ID = "276567e9-3c3f-4d29-8ab0-2bd00c4f91fc"
const DEMO_EMAIL = "demo@tripletto.local"
const DEMO_PASSWORD = "demo-password-123"

/**
 * Auto-sign in as the demo user (development only).
 * Creates a real Supabase session that works with RLS policies.
 * All auth.uid() checks will use this demo user's ID.
 */
export async function autoSignInDemoUser() {
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })

    if (error) {
      console.error("[v0] Auto-signin failed:", error.message)
      return null
    }

    return data.session
  } catch (err) {
    console.error("[v0] Auto-signin error:", err)
    return null
  }
}
