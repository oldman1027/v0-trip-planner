import { createClient } from "@/lib/supabase/server"
import { CalendarPageClient } from "@/components/trip/itinerary/calendar-page-client"
import type { Activity, Trip } from "@/lib/types"

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: trip }, { data: activities }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    supabase
      .from("activities")
      .select("*")
      .eq("trip_id", id)
      .order("position", { ascending: true }),
  ])

  if (!trip) return null

  return (
    <CalendarPageClient
      trip={trip}
      initialActivities={(activities ?? []) as Activity[]}
    />
  )
}
