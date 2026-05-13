"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function cancelInvitation(
  invitationId: string,
  tripId: string,
): Promise<{ status: "success" | "unauthorized" | "error" }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  const serviceClient = await createServiceClient()

  const { data: membership } = await serviceClient
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (membership?.role !== "owner") return { status: "unauthorized" }

  const { error } = await serviceClient
    .from("trip_invitations")
    .delete()
    .eq("id", invitationId)

  if (error) return { status: "error" }

  revalidatePath(`/trips/${tripId}/settings`)
  return { status: "success" }
}
