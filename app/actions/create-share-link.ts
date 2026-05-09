"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/auth-url"

export async function createOrRefreshShareLink(tripId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (membership?.role !== "owner") throw new Error("Only owners can manage share links")

  const serviceClient = await createServiceClient()
  const newToken = crypto.randomUUID()

  const { error } = await serviceClient
    .from("trip_share_links")
    .upsert(
      { trip_id: tripId, token: newToken, created_by_user_id: user.id, use_count: 0 },
      { onConflict: "trip_id" }
    )
  if (error) throw error

  return `${getSiteUrl()}/join/${newToken}`
}
