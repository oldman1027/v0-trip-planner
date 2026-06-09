import type { SupabaseClient } from "@supabase/supabase-js"

export type HistoryAction = "added" | "edited" | "deleted" | "moved"
export type HistoryEntityType = "activity" | "booking" | "trip"

export type TripHistoryEntry = {
  id: string
  trip_id: string
  changed_by: string | null
  changed_by_name: string
  action: HistoryAction
  entity_type: HistoryEntityType
  entity_name: string
  snapshot: {
    activities: Record<string, unknown>[]
    bookings: Record<string, unknown>[]
  }
  created_at: string
}

export async function recordHistory({
  supabase,
  tripId,
  userId,
  userName,
  action,
  entityType,
  entityName,
}: {
  supabase: SupabaseClient
  tripId: string
  userId: string
  userName: string
  action: HistoryAction
  entityType: HistoryEntityType
  entityName: string
}): Promise<void> {
  try {
    const [{ data: activities }, { data: bookings }] = await Promise.all([
      supabase.from("activities").select("*").eq("trip_id", tripId),
      supabase.from("bookings").select("*").eq("trip_id", tripId),
    ])

    const { error } = await supabase.from("trip_history").insert({
      trip_id: tripId,
      changed_by: userId,
      changed_by_name: userName,
      action,
      entity_type: entityType,
      entity_name: entityName,
      snapshot: { activities: activities ?? [], bookings: bookings ?? [] },
    })
    if (error) {
      console.warn("[history] failed to record:", error.message)
      return
    }

    // Prune entries older than 30 days (fire-and-forget)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    supabase
      .from("trip_history")
      .delete()
      .eq("trip_id", tripId)
      .lt("created_at", cutoff.toISOString())
      .then(() => null)
  } catch {
    // History is non-critical — never let it surface errors
  }
}
