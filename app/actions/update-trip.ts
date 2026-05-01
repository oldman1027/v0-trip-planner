"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function updateTrip(tripId: string, payload: {
  name: string
  destination: string | null
  start_date: string
  end_date: string
  cover_image_url: string | null
  default_currency: string
}) {
  // Get authenticated user from session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  // Use service role client to update
  const serviceClient = await createServiceClient()

  const { data, error } = await serviceClient
    .from("trips")
    .update(payload)
    .eq("id", tripId)
    .select()
    .single()

  if (error) {
    console.error("[v0] Update trip error:", error)
    throw error
  }

  return { trip: data }
}
