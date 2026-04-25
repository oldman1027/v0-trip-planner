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

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle()
  if (!trip) notFound()

  const { data: members } = await supabase
    .from("trip_members")
    .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
    .eq("trip_id", id)

  return (
    <div className="min-h-svh">
      <AppHeader />
      <TripHeader trip={trip as Trip} members={members ?? []} />
      <TripTabs tripId={id} />
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6">{children}</main>
    </div>
  )
}
