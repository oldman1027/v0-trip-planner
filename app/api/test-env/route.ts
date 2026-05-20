import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
    keyLength: process.env.GOOGLE_AI_API_KEY?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  })
}
