"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { seedFirstTripIfNeeded } from "@/app/actions/seed-first-trip"

export default function PostLoginPage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      try {
        const { tripId } = await seedFirstTripIfNeeded()
        if (tripId) {
          // New user: redirect to sample trip
          router.push(`/trips/${tripId}`)
        } else {
          // Returning user: redirect to trips list
          router.push("/trips")
        }
      } catch (err) {
        console.error("[v0] Post-login error:", err)
        // Fallback to trips list
        router.push("/trips")
      }
    }

    redirect()
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your trip...</p>
      </div>
    </div>
  )
}
