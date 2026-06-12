import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const rawNext = searchParams.get("next") ?? "/trips"
  // Reject protocol-relative URLs (//evil.com) and anything not starting with /
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/trips"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
