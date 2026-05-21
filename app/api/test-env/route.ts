import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    hasGoogleMapsKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    openRouterKeyLength: process.env.OPENROUTER_API_KEY?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  })
}
