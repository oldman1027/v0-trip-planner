import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { TripHeader } from "@/components/trip/trip-header"
import { TripTabs } from "@/components/trip/trip-tabs"
import { TripReadiness } from "@/components/trip/trip-readiness"
import { createClient } from "@/lib/supabase/server"
import { computeReadiness } from "@/lib/readiness"
import type { Activity, Booking, Trip } from "@/lib/types"

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: trip }, { data: bookings }, { data: activities }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("id, amount, payment_status").eq("trip_id", id),
    supabase
      .from("activities")
      .select("id, category, booking_id, is_wishlist")
      .eq("trip_id", id),
  ])
  if (!trip) notFound()

  const totalBudget = (bookings ?? []).reduce(
    (sum: number, b: { amount: number | null }) => sum + (b.amount ?? 0),
    0,
  )

  const readinessStats = computeReadiness(
    (activities ?? []) as Pick<Activity, "id" | "category" | "booking_id" | "is_wishlist">[],
    (bookings ?? []) as Pick<Booking, "id" | "payment_status">[],
  )

  return (
    <div className="min-h-svh">
      <AppHeader />
      <TripHeader trip={trip as Trip} totalBudget={totalBudget} />
      <TripTabs tripId={id} />
      <div className="mx-auto w-full max-w-6xl px-6 pt-4">
        <TripReadiness stats={readinessStats} />
      </div>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4">{children}</main>
    </div>
  )
}
