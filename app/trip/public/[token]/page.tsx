import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { MapPin, Calendar } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/server"
import { OverviewTab } from "@/components/trip/overview/overview-tab"
import { computeReadiness } from "@/lib/readiness"
import { detectConflicts } from "@/lib/time-conflicts"
import { formatRange, tripDuration } from "@/lib/dates"
import type { Activity, Booking, Trip } from "@/lib/types"

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const serviceClient = await createServiceClient()

  const { data: trip } = await serviceClient
    .from("trips")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle<Trip>()

  if (!trip) return notFound()

  const [{ data: activities }, { data: bookings }] = await Promise.all([
    serviceClient
      .from("activities")
      .select("*")
      .eq("trip_id", trip.id)
      .order("position", { ascending: true }),
    serviceClient.from("bookings").select("*").eq("trip_id", trip.id),
  ])

  const acts = (activities ?? []) as Activity[]
  const bkgs = (bookings ?? []) as Booking[]
  const conflictMap = detectConflicts(acts)
  const readinessStats = computeReadiness(acts, bkgs, conflictMap.size)

  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"
  const duration = tripDuration(trip.start_date, trip.end_date)

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal app header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-serif text-lg">Tripletto</span>
          </Link>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            Shared trip
          </span>
        </div>
      </header>

      {/* Cover image */}
      <div className="relative h-36 w-full overflow-hidden md:h-48">
        <Image
          src={cover}
          alt={`${trip.name} cover`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-6 pb-4">
          <h1 className="font-serif text-3xl tracking-tight text-white md:text-4xl">
            {trip.name}
          </h1>
        </div>
      </div>

      {/* Info bar */}
      <div className="border-b border-border bg-background/95">
        <div className="mx-auto w-full max-w-6xl px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {trip.destination}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatRange(trip.start_date, trip.end_date)}
            </span>
            <span>
              {duration} {duration === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
      </div>

      {/* Read-only overview */}
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <OverviewTab
          trip={trip}
          activities={acts}
          bookings={bkgs}
          readinessStats={readinessStats}
        />
      </main>
    </div>
  )
}
