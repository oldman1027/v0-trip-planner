"use server"

import { createClient } from "@/lib/supabase/server"
import type { Activity, TimeBlock } from "@/lib/types"

type AISuggestion = {
  title: string
  category: Activity["category"]
  location: string | null
  time_block: TimeBlock
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  day_date: string
}

export async function addAIActivities(tripId: string, currency: string, suggestions: AISuggestion[]) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("activities")
    .select("day_date, time_block, position")
    .eq("trip_id", tripId)

  const positionMap = new Map<string, number>()
  for (const a of existing ?? []) {
    const key = `${a.day_date}::${a.time_block}`
    positionMap.set(key, Math.max(positionMap.get(key) ?? 0, a.position + 1))
  }

  const rows = suggestions.map((s) => {
    const key = `${s.day_date}::${s.time_block}`
    const pos = positionMap.get(key) ?? 0
    positionMap.set(key, pos + 1)
    return {
      trip_id: tripId,
      day_date: s.day_date,
      time_block: s.time_block,
      position: pos,
      title: s.title,
      location: s.location,
      start_time: s.start_time,
      end_time: s.end_time,
      notes: s.notes,
      cost_amount: s.cost_amount,
      cost_currency: currency,
      category: s.category,
      photo_url: null,
      booking_id: null,
      is_wishlist: false,
    }
  })

  const { data, error } = await supabase.from("activities").insert(rows).select()
  if (error) throw error
  return data as Activity[]
}
