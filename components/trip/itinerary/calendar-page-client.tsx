"use client"

import { useMemo, useState } from "react"
import { CalendarView } from "./calendar-view"
import { ActivityDrawer } from "./activity-drawer"
import { createClient } from "@/lib/supabase/client"
import { daysBetween } from "@/lib/dates"
import { toast } from "sonner"
import type { Activity, TimeBlock, Trip } from "@/lib/types"

export function CalendarPageClient({
  trip,
  initialActivities,
}: {
  trip: Trip
  initialActivities: Activity[]
}) {
  const days = useMemo(
    () => daysBetween(trip.start_date, trip.end_date),
    [trip.start_date, trip.end_date],
  )

  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [drawerState, setDrawerState] = useState<
    | { mode: "create"; day_date: string; time_block: TimeBlock }
    | { mode: "edit"; activity: Activity }
    | null
  >(null)

  async function handleSave(input: {
    id?: string
    day_date: string
    time_block: TimeBlock
    title: string
    location: string | null
    start_time: string | null
    end_time: string | null
    notes: string | null
    cost_amount: number | null
    photo_url: string | null
    category: Activity["category"]
    needs_booking: boolean
  }) {
    const supabase = createClient()

    if (input.id) {
      const { error } = await supabase
        .from("activities")
        .update({
          day_date: input.day_date,
          time_block: input.time_block,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          photo_url: input.photo_url,
          category: input.category,
        })
        .eq("id", input.id)
      if (error) throw error
      setActivities((prev) => prev.map((a) => (a.id === input.id ? { ...a, ...input } : a)))
      toast.success("Activity updated")
    } else {
      const position = activities.filter(
        (a) => a.day_date === input.day_date && a.time_block === input.time_block,
      ).length
      const { data, error } = await supabase
        .from("activities")
        .insert({
          trip_id: trip.id,
          day_date: input.day_date,
          time_block: input.time_block,
          position,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          cost_currency: trip.default_currency ?? "USD",
          photo_url: input.photo_url,
          category: input.category,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setActivities((prev) => [...prev, data as Activity])
      toast.success("Activity added")
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const prev = activities
    setActivities((p) => p.filter((a) => a.id !== id))
    const { error } = await supabase.from("activities").delete().eq("id", id)
    if (error) {
      setActivities(prev)
      toast.error("Could not delete")
      throw error
    }
    toast.success("Activity removed")
  }

  return (
    <>
      <CalendarView
        days={days}
        activities={activities}
        destination={trip.destination}
        onActivityClick={(a) => setDrawerState({ mode: "edit", activity: a })}
      />
      <ActivityDrawer
        state={drawerState}
        days={days}
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setDrawerState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
