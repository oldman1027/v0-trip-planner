import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key?.substring(0, 12) ?? "none",
    nodeEnv: process.env.NODE_ENV,
  })
}
