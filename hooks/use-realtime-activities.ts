"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Activity } from "@/lib/types"

interface UseRealtimeActivitiesProps {
  tripId: string
  onInsert: (activity: Activity) => void
  onUpdate: (activity: Activity) => void
  onDelete: (activityId: string) => void
}

export function useRealtimeActivities({
  tripId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeActivitiesProps) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`activities:trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          onInsert(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          onUpdate(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          onDelete((payload.old as { id: string }).id)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, onInsert, onUpdate, onDelete])
}
