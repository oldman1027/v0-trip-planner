// AUTH DISABLED FOR DEV
// This wrapper automatically signs in the demo user on app load.
// See lib/dev-auth.ts for re-enablement instructions.

"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function DevAutoSignInWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true

    async function ensureSession() {
      // Skip on /auth routes (they handle their own flow)
      if (pathname?.startsWith("/auth")) {
        return
      }

      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()

      if (session?.session) {
        // Already signed in
        return
      }

      // Try to sign in as demo user
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: "demo@tripletto.local",
          password: "demo-password-123",
        })

        if (error) {
          console.error("[v0] Auto-signin failed:", error.message)
          return
        }

        if (data.session) {
          // Redirect to home/trips on successful signin
          if (pathname === "/login" || pathname === "/") {
            router.replace("/trips")
          }
        }
      } catch (err) {
        console.error("[v0] Auto-signin error:", err)
      }
    }

    ensureSession()
  }, [pathname, router])

  return <>{children}</>
}
