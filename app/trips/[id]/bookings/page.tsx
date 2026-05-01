import { BookingsList } from "@/components/trip/bookings/bookings-list"
import { createClient } from "@/lib/supabase/server"
import type { Booking, Trip } from "@/lib/types"

export default async function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: trip }, { data: bookings }] = await Promise.all([
    supabase
      .from("trips")
      .select("default_currency, start_date, end_date")
      .eq("id", id)
      .maybeSingle<Pick<Trip, "default_currency" | "start_date" | "end_date">>(),
    supabase.from("bookings").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
  ])

  return (
    <BookingsList
      tripId={id}
      initialBookings={(bookings ?? []) as Booking[]}
      currency={trip?.default_currency ?? "USD"}
      tripStart={trip?.start_date ?? ""}
      tripEnd={trip?.end_date ?? ""}
    />
  )
}
