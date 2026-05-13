"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendTripInvitationEmail } from "@/lib/email"

export type InviteResult =
  | { status: "success"; memberName: string }
  | { status: "not_found" }
  | { status: "already_member" }
  | { status: "unauthorized" }
  | { status: "error"; message: string }

export async function inviteToTrip(tripId: string, email: string): Promise<InviteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  // Caller must be trip owner
  const { data: callerMembership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (callerMembership?.role !== "owner") return { status: "unauthorized" }

  const serviceClient = await createServiceClient()

  // Look up invitee UUID by email via SECURITY DEFINER SQL function
  const { data: inviteeId, error: lookupError } = await serviceClient.rpc("get_user_id_by_email", {
    lookup_email: email,
  })
  if (lookupError || !inviteeId) return { status: "not_found" }
  const targetUserId = inviteeId as string

  // Check existing membership
  const { data: existing } = await serviceClient
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("user_id", targetUserId)
    .maybeSingle()
  if (existing) return { status: "already_member" }

  // Fetch trip name, caller profile, and invitee profile in parallel
  const [{ data: trip }, { data: callerProfile }, { data: inviteeProfile }] = await Promise.all([
    serviceClient.from("trips").select("name").eq("id", tripId).maybeSingle(),
    serviceClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    serviceClient.from("profiles").select("full_name").eq("id", targetUserId).maybeSingle(),
  ])

  const { error: insertError } = await serviceClient
    .from("trip_members")
    .insert({ trip_id: tripId, user_id: targetUserId, role: "editor", invited_by_user_id: user.id })
  if (insertError) return { status: "error", message: insertError.message }

  const callerName = callerProfile?.full_name ?? user.email ?? "Someone"
  const tripName = trip?.name ?? "a trip"

  // Fire email and in-app notification concurrently; don't block the response on either
  await Promise.allSettled([
    sendTripInvitationEmail({ toEmail: email, inviterName: callerName, tripName, tripId }),
    serviceClient.from("notifications").insert({
      user_id: targetUserId,
      type: "trip_invitation",
      title: "You've been invited to a trip",
      message: `${callerName} invited you to join "${tripName}"`,
      link: `/trips/${tripId}/group`,
      metadata: { trip_id: tripId, invited_by: user.id },
    }),
  ])

  revalidatePath(`/trips/${tripId}/group`)

  const memberName = inviteeProfile?.full_name ?? email
  return { status: "success", memberName }
}
