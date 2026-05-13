"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendTripInvitationEmail } from "@/lib/email"

export async function sendNewUserInvitation(
  tripId: string,
  email: string,
): Promise<{ status: "success" | "unauthorized" | "error" }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  const serviceClient = await createServiceClient()
  const [{ data: trip }, { data: callerProfile }] = await Promise.all([
    serviceClient.from("trips").select("name").eq("id", tripId).maybeSingle(),
    serviceClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ])

  const callerName = callerProfile?.full_name ?? user.email ?? "Someone"
  const tripName = trip?.name ?? "a trip"

  try {
    await sendTripInvitationEmail({ toEmail: email, inviterName: callerName, tripName, tripId, isNewUser: true })
    return { status: "success" }
  } catch {
    return { status: "error" }
  }
}
