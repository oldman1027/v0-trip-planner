"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PostLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Simply redirect authenticated users to trips list
    router.push("/trips")
  }, [router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Loading your trips...</p>
      </div>
    </div>
  )
}
