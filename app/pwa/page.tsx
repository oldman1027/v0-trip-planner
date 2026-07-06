"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PwaStartPage() {
  const router = useRouter()

  useEffect(() => {
    const lastTrip = localStorage.getItem("pwa_last_trip")
    if (lastTrip) {
      router.replace(`/m/${lastTrip}`)
    } else {
      // No trip saved yet — go to the main trips list
      router.replace("/")
    }
  }, [router])

  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      style={{ background: "#FFFBF4" }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "#A9D6C5", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "#9BA8A6" }}>Opening your trip…</p>
      </div>
    </div>
  )
}
