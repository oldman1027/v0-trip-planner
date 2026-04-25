"use server"

import { createClient } from "@/lib/supabase/server"

export async function deleteTrip(tripId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("trips").delete().eq("id", tripId).eq("created_by", user.id)

  if (error) {
    console.error("[v0] Delete trip error:", error)
    throw error
  }

  return { success: true }
}
