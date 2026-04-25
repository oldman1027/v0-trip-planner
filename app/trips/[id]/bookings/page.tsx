import { BookingsList } from "@/components/trip/bookings/bookings-list"
import { createClient } from "@/lib/supabase/server"
import type { Booking } from "@/lib/types"

export default async function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })

  return <BookingsList tripId={id} initialBookings={(bookings ?? []) as Booking[]} />
}
