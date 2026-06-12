"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { TimeBlock } from "@/lib/types"

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

async function requireTripMemberForActivity(activityId: string, userId: string, db: ServiceClient) {
  const { data: act } = await db
    .from("activities")
    .select("trip_id")
    .eq("id", activityId)
    .single()
  if (!act) throw new Error("Activity not found")

  const { data: membership } = await db
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", act.trip_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (!membership) throw new Error("Not authorized")
}

export async function moveActivity(
  activityId: string,
  day: string,
  block: TimeBlock,
  position: number,
  startTime?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const db = await createServiceClient()
  await requireTripMemberForActivity(activityId, user.id, db)

  const { error } = await db
    .from("activities")
    .update({ day_date: day, time_block: block, position, start_time: startTime ?? null })
    .eq("id", activityId)

  if (error) {
    console.error("[v0] Move activity error:", error)
    throw error
  }

  return { success: true }
}

export async function sendActivityToKIV(activityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const db = await createServiceClient()
  await requireTripMemberForActivity(activityId, user.id, db)

  const { error } = await db
    .from("activities")
    .update({ is_kiv: true, day_date: null, time_block: null, start_time: null, position: 0 })
    .eq("id", activityId)
  if (error) throw error
  return { success: true }
}

export async function scheduleKIVActivity(
  activityId: string,
  day: string,
  block: TimeBlock,
  position: number,
  startTime?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const db = await createServiceClient()
  await requireTripMemberForActivity(activityId, user.id, db)

  const { error } = await db
    .from("activities")
    .update({ is_kiv: false, day_date: day, time_block: block, position, start_time: startTime ?? null })
    .eq("id", activityId)
  if (error) throw error
  return { success: true }
}

export async function reorderActivities(updates: Array<{ id: string; position: number }>) {
  if (updates.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const db = await createServiceClient()
  // All updates come from the same trip view — verify membership via the first activity's trip
  await requireTripMemberForActivity(updates[0].id, user.id, db)

  await Promise.all(
    updates.map(({ id, position }) =>
      db.from("activities").update({ position }).eq("id", id)
    )
  )

  return { success: true }
}
