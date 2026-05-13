"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendTripInvitationEmail } from "@/lib/email"

export async function sendNewUserInvitation(
  tripId: string,
  email: string,
): Promise<{ status: "success" | "unauthorized" | "error" | "already_invited" }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  const serviceClient = await createServiceClient()

  // Verify caller is trip owner
  const { data: membership } = await serviceClient
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (membership?.role !== "owner") return { status: "unauthorized" }

  const [{ data: trip }, { data: callerProfile }] = await Promise.all([
    serviceClient.from("trips").select("name").eq("id", tripId).maybeSingle(),
    serviceClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ])

  // Store pending invitation (upsert to handle re-invites gracefully)
  await serviceClient
    .from("trip_invitations")
    .upsert(
      { trip_id: tripId, email, invited_by_user_id: user.id, status: "pending" },
      { onConflict: "trip_id,email" },
    )

  const callerName = callerProfile?.full_name ?? user.email ?? "Someone"
  const tripName = trip?.name ?? "a trip"

  try {
    await sendTripInvitationEmail({ toEmail: email, inviterName: callerName, tripName, tripId, isNewUser: true })
    return { status: "success" }
  } catch {
    return { status: "error" }
  }
}
