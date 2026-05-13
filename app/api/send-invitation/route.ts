import { createClient } from "@/lib/supabase/server"
import { sendTripInvitationEmail } from "@/lib/email"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { toEmail, inviterName, tripName, tripId, isNewUser } = body as {
    toEmail: string
    inviterName: string
    tripName: string
    tripId: string
    isNewUser?: boolean
  }

  if (!toEmail || !inviterName || !tripName || !tripId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    await sendTripInvitationEmail({ toEmail, inviterName, tripName, tripId, isNewUser })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("send-invitation error:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
