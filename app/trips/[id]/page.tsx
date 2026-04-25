import { ItineraryBoard } from "@/components/trip/itinerary/itinerary-board"
import { createClient } from "@/lib/supabase/server"
import type { Activity, Trip } from "@/lib/types"

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle()
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("trip_id", id)
    .order("position", { ascending: true })

  return <ItineraryBoard trip={trip as Trip} initialActivities={(activities ?? []) as Activity[]} />
}
