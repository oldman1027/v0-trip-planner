import { notFound, redirect } from "next/navigation"
import { TripSidebarLayout } from "@/components/trip/trip-sidebar-layout"
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider"
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
    <>
      <TripSidebarLayout
        trip={trip as Trip}
        totalBudget={totalBudget}
        isOwner={isOwner}
      >
        {children}
      </TripSidebarLayout>
      <KeyboardShortcutsProvider />
    </>
  )
}
