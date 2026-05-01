import { createClient } from "@/lib/supabase/server"
import { OverviewTab } from "@/components/trip/overview/overview-tab"
import { computeReadiness } from "@/lib/readiness"
import { detectConflicts } from "@/lib/time-conflicts"
import type { Activity, Booking, Trip } from "@/lib/types"

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: trip }, { data: activities }, { data: bookings }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    supabase
      .from("activities")
      .select("*")
      .eq("trip_id", id)
      .order("position", { ascending: true }),
    supabase.from("bookings").select("*").eq("trip_id", id),
  ])

  if (!trip) return null

  const acts = (activities ?? []) as Activity[]
  const bkgs = (bookings ?? []) as Booking[]

  const conflictMap = detectConflicts(acts)
  const readinessStats = computeReadiness(acts, bkgs, conflictMap.size)

  return (
    <OverviewTab
      trip={trip}
      activities={acts}
      bookings={bkgs}
      readinessStats={readinessStats}
    />
  )
}
