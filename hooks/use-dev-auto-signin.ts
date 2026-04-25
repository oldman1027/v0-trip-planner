// AUTH DISABLED FOR DEV
// This hook automatically signs in as the demo user on app load.
// See lib/dev-auth.ts for re-enablement instructions.

"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function useDevAutoSignIn() {
  const router = useRouter()
  const checked = useRef(false)

  useEffect(() => {
    // Only run once per component mount
    if (checked.current) return
    checked.current = true

    async function ensureSession() {
      const supabase = createClient()

      // Check if already authenticated
      const { data: session } = await supabase.auth.getSession()
      if (session?.session) {
        // Already signed in
        return
      }

      // Sign in as demo user
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: "demo@tripletto.local",
          password: "demo-password-123",
        })

        if (!error && data.session) {
          // Session established, redirect to trips
          router.push("/trips")
        }
      } catch (err) {
        console.error("[v0] Dev auto-signin failed:", err)
      }
    }

    ensureSession()
  }, [router])
}
