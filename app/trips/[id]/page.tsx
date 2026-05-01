import { ItineraryBoard } from "@/components/trip/itinerary/itinerary-board"
import { createClient } from "@/lib/supabase/server"
import type { Activity, Booking, Trip } from "@/lib/types"

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: trip }, { data: activities }, { data: bookings }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("trip_id", id).order("position", { ascending: true }),
    supabase.from("bookings").select("*").eq("trip_id", id),
  ])

  return (
    <ItineraryBoard
      trip={trip as Trip}
      initialActivities={(activities ?? []) as Activity[]}
      initialBookings={(bookings ?? []) as Booking[]}
    />
  )
}
