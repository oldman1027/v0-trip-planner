import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { TripHeader } from "@/components/trip/trip-header"
import { TripTabs } from "@/components/trip/trip-tabs"
import { createClient } from "@/lib/supabase/server"
import type { Trip } from "@/lib/types"

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

  const [{ data: trip }, { data: bookings }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("id, amount").eq("trip_id", id),
  ])
  if (!trip) notFound()

  const totalBudget = (bookings ?? []).reduce(
    (sum: number, b: { amount: number | null }) => sum + (b.amount ?? 0),
    0,
  )

  return (
    <div className="min-h-svh">
      <AppHeader />
      <TripHeader trip={trip as Trip} totalBudget={totalBudget} />
      <TripTabs tripId={id} />
      <main className="w-full px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
