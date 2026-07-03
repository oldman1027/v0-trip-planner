import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MobileShell } from "./mobile-shell"
import { normalizeMembers } from "@/lib/types"
import { geocodeDestination, fetchWeatherForecast } from "@/lib/weather"
import type { Activity, Booking, Expense, Trip } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function MobilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: trip },
    { data: activitiesRaw },
    { data: bookingsRaw },
    { data: expensesRaw },
    { data: membersRaw },
    { data: membership },
  ] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("activities")
      .select("*")
      .eq("trip_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("bookings")
      .select("*, booking_attachments(*)")
      .eq("trip_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("*, splits:expense_splits(*)")
      .eq("trip_id", id)
      .order("date", { ascending: false }),
    supabase
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id),
    supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (!trip) notFound()
  // Must be a member
  if (!membership) redirect(`/trips/${id}`)

  // Fetch weather (best-effort)
  let weather = null
  if (trip.destination) {
    const coords = await geocodeDestination(trip.destination)
    if (coords) {
      weather = await fetchWeatherForecast(coords.latitude, coords.longitude, trip.destination)
    }
  }

  return (
    <MobileShell
      trip={trip as Trip}
      activities={(activitiesRaw ?? []) as Activity[]}
      bookings={(bookingsRaw ?? []) as Booking[]}
      expenses={(expensesRaw ?? []) as Expense[]}
      members={normalizeMembers(membersRaw)}
      weather={weather}
    />
  )
}
