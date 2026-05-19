import { createClient } from "./client"
import { normalizeMembers, type MemberWithProfile, type TripShareLink } from "@/lib/types"

export async function getTripCollaborators(tripId: string): Promise<MemberWithProfile[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("trip_members")
    .select("trip_id, user_id, role, joined_at, last_activity_at, invited_by_user_id, profile:profiles!trip_members_user_id_profiles_fkey(id, full_name, avatar_url, created_at)")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true })
  if (error) throw error
  return normalizeMembers(data)
}

export async function getTripShareLink(tripId: string): Promise<TripShareLink | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("trip_share_links")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function removeCollaborator(tripId: string, userId: string): Promise<void> {
  const supabase = createClient()
  // Prevent removing owners via client — server-side guard covers it too
  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle()
  if (member?.role === "owner") throw new Error("Cannot remove the trip owner")

  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
  if (error) throw error
}

export async function leaveTrip(tripId: string, userId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
  if (error) throw error
}
