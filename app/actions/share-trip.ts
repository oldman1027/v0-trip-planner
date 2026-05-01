"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function setTripPublic(tripId: string, isPublic: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const serviceClient = await createServiceClient()

  const { data, error } = await serviceClient
    .from("trips")
    .update({ is_public: isPublic })
    .eq("id", tripId)
    .select("id, share_token, is_public")
    .single()

  if (error) {
    console.error("[share-trip] setTripPublic error:", error)
    throw error
  }

  revalidatePath(`/trips/${tripId}`)
  return data as { id: string; share_token: string; is_public: boolean }
}

export async function shareTrip(tripId: string): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const serviceClient = await createServiceClient()

  // Fetch existing token first
  const { data: existing, error: fetchError } = await serviceClient
    .from("trips")
    .select("share_token, is_public")
    .eq("id", tripId)
    .single()

  if (fetchError) throw fetchError

  // Reuse existing token or let DB generate via crypto.randomUUID() fallback
  const token = existing?.share_token ?? crypto.randomUUID()

  const { data, error } = await serviceClient
    .from("trips")
    .update({ is_public: true, share_token: token })
    .eq("id", tripId)
    .select("share_token")
    .single()

  if (error) {
    console.error("[share-trip] shareTrip error:", error)
    throw error
  }

  revalidatePath(`/trips/${tripId}`)
  return data.share_token as string
}
