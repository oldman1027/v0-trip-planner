import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { NotificationsPopover } from "@/components/notifications-popover"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/components/trips/trip-card"
import { TripsEmpty } from "@/components/trips/trips-empty"
import { createClient } from "@/lib/supabase/server"
import { normalizeMembers, type Trip } from "@/lib/types"

export default async function TripsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true })

  // Fetch members per trip (small N, simple loop)
  const tripIds = (trips ?? []).map((t) => t.id)
  const membersRaw = tripIds.length
    ? (
        await supabase
          .from("trip_members")
          .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
          .in("trip_id", tripIds)
      ).data
    : []
  const members = normalizeMembers(membersRaw)

  return (
    <div className="min-h-svh">
      <AppHeader>
        <NotificationsPopover />
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl tracking-tight">Your trips</h1>
            <p className="mt-2 text-muted-foreground">Everything in one shared timeline.</p>
          </div>
          <Button asChild className="rounded-xl">
            <Link href="/trips/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New trip
            </Link>
          </Button>
        </div>

        {trips && trips.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t: Trip) => (
              <TripCard
                key={t.id}
                trip={t}
                members={(members ?? []).filter((m: { trip_id: string }) => m.trip_id === t.id)}
              />
            ))}
          </div>
        ) : (
          <TripsEmpty />
        )}
      </main>
    </div>
  )
}
