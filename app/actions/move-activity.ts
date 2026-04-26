"use server"

import { createServiceClient } from "@/lib/supabase/server"
import type { TimeBlock } from "@/lib/types"

export async function moveActivity(
  activityId: string,
  day: string,
  block: TimeBlock,
  position: number
) {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from("activities")
    .update({ day_date: day, time_block: block, position })
    .eq("id", activityId)

  if (error) {
    console.error("[v0] Move activity error:", error)
    throw error
  }

  return { success: true }
}

export async function reorderActivities(
  updates: Array<{ id: string; position: number }>
) {
  const supabase = await createServiceClient()

  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from("activities").update({ position }).eq("id", id)
    )
  )

  return { success: true }
}
