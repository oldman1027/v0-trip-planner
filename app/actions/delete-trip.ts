"use server"

import { createClient } from "@/lib/supabase/server"

export async function deleteTrip(tripId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { data: trip } = await supabase
    .from("trips")
    .select("created_by")
    .eq("id", tripId)
    .single()

  if (trip?.created_by !== user.id) {
    throw new Error("Only the trip owner can delete this trip")
  }

  const { error } = await supabase.from("trips").delete().eq("id", tripId)

  if (error) {
    console.error("[v0] Delete trip error:", error)
    throw error
  }

  return { success: true }
}
