"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export type JoinResult =
  | { status: "success"; tripId: string }
  | { status: "already_member"; tripId: string }
  | { status: "unauthenticated" }
  | { status: "invalid_token" }

export async function joinTrip(token: string): Promise<JoinResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthenticated" }

  const serviceClient = await createServiceClient()

  const { data: link } = await serviceClient
    .from("trip_share_links")
    .select("id, trip_id, use_count")
    .eq("token", token)
    .maybeSingle()
  if (!link) return { status: "invalid_token" }

  // Check existing membership
  const { data: existing } = await serviceClient
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", link.trip_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (existing) return { status: "already_member", tripId: link.trip_id }

  const { error } = await serviceClient
    .from("trip_members")
    .insert({ trip_id: link.trip_id, user_id: user.id, role: "editor" })
  if (error) return { status: "invalid_token" }

  // Update link usage stats
  await serviceClient
    .from("trip_share_links")
    .update({ last_used_at: new Date().toISOString(), use_count: link.use_count + 1 })
    .eq("id", link.id)

  // Notify the trip owner
  const { data: ownerRow } = await serviceClient
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", link.trip_id)
    .eq("role", "owner")
    .maybeSingle()

  if (ownerRow) {
    const { data: joinerProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
    const joinerName = joinerProfile?.full_name ?? user.email ?? "Someone"

    await serviceClient.from("notifications").insert({
      user_id: ownerRow.user_id,
      type: "joined_trip",
      title: "New traveler joined",
      message: `${joinerName} joined your trip via the share link`,
      link: `/trips/${link.trip_id}/group`,
      metadata: { trip_id: link.trip_id, joined_user_id: user.id },
    })
  }

  revalidatePath(`/trips/${link.trip_id}/group`)
  return { status: "success", tripId: link.trip_id }
}
