import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { TripHeader } from "@/components/trip/trip-header"
import { TripTabs } from "@/components/trip/trip-tabs"
import { NotificationsPopover } from "@/components/notifications-popover"
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

  const [{ data: trip }, { data: bookings }, { data: membership }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("id, amount").eq("trip_id", id),
    supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])
  if (!trip) notFound()

  const totalBudget = (bookings ?? []).reduce(
    (sum: number, b: { amount: number | null }) => sum + (b.amount ?? 0),
    0,
  )
  const isOwner = membership?.role === "owner"

  return (
    <div className="min-h-svh">
      <AppHeader>
        <NotificationsPopover />
      </AppHeader>
      <TripHeader trip={trip as Trip} totalBudget={totalBudget} isOwner={isOwner} />
      <TripTabs tripId={id} />
      <main className="w-full pb-16 pt-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
