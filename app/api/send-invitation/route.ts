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

  // Verify the caller actually owns this trip — prevents using this route as a
  // free email cannon with arbitrary content sent from our domain.
  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await sendTripInvitationEmail({ toEmail, inviterName, tripName, tripId, isNewUser })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("send-invitation error:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
