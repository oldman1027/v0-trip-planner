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
    const channelName = `activities:trip:${tripId}`
    console.log(`[realtime] subscribing to ${channelName}`)

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          console.log("[realtime] INSERT received:", (payload.new as Activity)?.id, payload.new)
          onInsertRef.current(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          console.log("[realtime] UPDATE received:", (payload.new as Activity)?.id, payload.new)
          onUpdateRef.current(payload.new as Activity)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          // payload.old contains all columns because activities uses REPLICA IDENTITY FULL
          const id = (payload.old as { id: string }).id
          console.log("[realtime] DELETE received:", id, payload.old)
          onDeleteRef.current(id)
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`[realtime] channel error (${channelName}):`, err)
        } else {
          console.log(`[realtime] channel status (${channelName}):`, status)
        }
      })

    return () => {
      console.log(`[realtime] removing channel ${channelName}`)
      supabase.removeChannel(channel)
    }
  // Only re-subscribe when the trip changes. Callbacks are read from refs.
  }, [tripId])
}
