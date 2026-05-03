import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin")
  const destination = req.nextUrl.searchParams.get("destination")
  if (!origin || !destination) return NextResponse.json({ mins: null })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ mins: null })

  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&mode=driving` +
      `&key=${key}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status === "OK") {
      return NextResponse.json({ mins: Math.round(element.duration.value / 60) })
    }
  } catch {
    // fall through to null response
  }

  return NextResponse.json({ mins: null })
}
