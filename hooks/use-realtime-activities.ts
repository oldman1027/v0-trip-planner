"use client"

import { useEffect, useRef } from "react"
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
  // Keep callbacks in refs so the channel is only recreated when tripId changes,
  // not when the parent re-renders with new (but functionally identical) callbacks.
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`activities:trip:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          onInsertRef.current(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          onUpdateRef.current(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          // payload.old contains all columns because activities uses REPLICA IDENTITY FULL
          onDeleteRef.current((payload.old as { id: string }).id)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // Only re-subscribe when the trip changes. Callbacks are read from refs.
  }, [tripId])
}
