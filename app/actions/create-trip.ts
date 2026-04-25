"use server"

import { createClient } from "@/lib/supabase/server"

export async function createTrip(payload: {
  name: string
  destination: string | null
  start_date: string
  end_date: string
  cover_image_url: string | null
}) {
  // AUTH DISABLED FOR DEV: Using server client with cookies for proper auth context
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  // Debug logging to diagnose RLS issues
  console.log("[create-trip] auth.uid will be:", user.id)
  console.log("[create-trip] payload created_by:", user.id)

  const { data, error } = await supabase
    .from("trips")
    .insert({
      ...payload,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Create trip error:", error)
    throw error
  }

  return { trip: data }
}
