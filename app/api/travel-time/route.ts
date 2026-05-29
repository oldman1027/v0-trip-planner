import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin")
  const destination = req.nextUrl.searchParams.get("destination")
  if (!origin || !destination) return NextResponse.json({ minutes: null })

  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return NextResponse.json({ minutes: 0 })
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) {
    console.warn("[travel-time] No Google Maps API key configured")
    return NextResponse.json({ minutes: null })
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&mode=driving` +
      `&key=${key}`

    const res = await fetch(url, { next: { revalidate: 86400 } })
    const data = await res.json()

    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === "OK") {
      const minutes = Math.round(element.duration.value / 60)
      return NextResponse.json({ minutes })
    }

    console.warn("[travel-time] Non-OK element status:", element?.status, "| top-level status:", data?.status, "| origin:", origin, "→", destination)
  } catch (err) {
    console.error("[travel-time] fetch error:", err)
  }

  return NextResponse.json({ minutes: null })
}
