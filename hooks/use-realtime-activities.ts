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
    // Each effect invocation gets a unique suffix so React StrictMode's
    // cleanup+remount never reuses the same channel name on the singleton client.
    // Reusing a name on the same client instance can produce a stale channel
    // object whose postgres_changes bindings were never re-registered server-side,
    // leaving the subscription showing SUBSCRIBED but silently dropping all events.
    const channelName = `activities:trip:${tripId}:${Math.random().toString(36).slice(2, 8)}`
    console.log(`[realtime] subscribing to ${channelName}`)

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          console.log("[board] INSERT received:", payload.new)
          console.log("[realtime] INSERT received:", (payload.new as Activity)?.id)
          try {
            onInsertRef.current(payload.new as Activity)
          } catch (e) {
            console.error("[realtime] onInsert callback threw:", e)
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          console.log("[board] UPDATE received:", payload.new)
          console.log("[realtime] UPDATE received:", (payload.new as Activity)?.id)
          try {
            onUpdateRef.current(payload.new as Activity)
          } catch (e) {
            console.error("[realtime] onUpdate callback threw:", e)
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        (payload: RealtimePostgresChangesPayload<Activity>) => {
          // payload.old contains all columns because activities uses REPLICA IDENTITY FULL
          const id = (payload.old as { id: string }).id
          console.log("[board] DELETE received:", payload.old)
          console.log("[realtime] DELETE received:", id)
          try {
            onDeleteRef.current(id)
          } catch (e) {
            console.error("[realtime] onDelete callback threw:", e)
          }
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
