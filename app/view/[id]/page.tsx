import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Calendar, Clock, MapPin } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/server"
import { formatRange, formatLongDate } from "@/lib/dates"

export const metadata: Metadata = {
  robots: "noindex, nofollow",
}

// ── Safe types — only fields we're willing to expose ─────────────────────────

type SafeActivity = {
  id: string
  day_date: string | null
  position: number
  title: string
  location: string | null
  start_time: string | null
  category: string
}

type SafeBooking = {
  id: string
  type: string
  title: string
  booking_date: string | null
  check_in_time: string | null
  check_out_time: string | null
  check_out_date: string | null
  departure_time: string | null
  arrival_time: string | null
  details: Record<string, unknown> | null
}

// ── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, string> = {
  dining:        "🍽️",
  experiences:   "🎯",
  transport:     "✈️",
  accommodation: "🏨",
  other:         "📍",
}

// ── Error states ──────────────────────────────────────────────────────────────

function ErrorPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="font-serif text-2xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <Link href="/" className="mt-2 text-sm underline underline-offset-4 hover:text-foreground">
        Go to Tripletto
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ViewTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams

  if (!token) {
    return (
      <ErrorPage
        title="Invalid link"
        body="This link is missing a share token. Ask the trip organiser for the full link."
      />
    )
  }

  const serviceClient = await createServiceClient()

  // Fetch only safe, non-sensitive trip fields
  const { data: trip } = await serviceClient
    .from("trips")
    .select("id, name, destination, start_date, end_date, cover_image_url, share_token_expires_at")
    .eq("id", id)
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle()

  if (!trip) {
    return (
      <ErrorPage
        title="Link not found"
        body="This link is invalid or has been revoked. Ask the trip organiser for a new link."
      />
    )
  }

  // Server-side expiry check — never trust the client
  if (trip.share_token_expires_at && new Date(trip.share_token_expires_at) < new Date()) {
    return (
      <ErrorPage
        title="Link expired"
        body="This shared link has expired. Ask the trip organiser for a fresh link."
      />
    )
  }

  // Fetch activities — safe columns only (no notes, no cost fields)
  const { data: activitiesRaw } = await serviceClient
    .from("activities")
    .select("id, day_date, position, title, location, start_time, category")
    .eq("trip_id", id)
    .order("day_date", { ascending: true })
    .order("position", { ascending: true })

  // Fetch bookings — safe columns only (no confirmation_number, booking_url, amount, notes)
  const { data: bookingsRaw } = await serviceClient
    .from("bookings")
    .select("id, type, title, booking_date, check_in_time, check_out_time, check_out_date, departure_time, arrival_time, details")
    .eq("trip_id", id)

  const activities = (activitiesRaw ?? []) as SafeActivity[]
  const bookings = (bookingsRaw ?? []) as SafeBooking[]

  // Group activities by day
  const dayMap = new Map<string, SafeActivity[]>()
  for (const act of activities) {
    if (!act.day_date) continue
    const existing = dayMap.get(act.day_date) ?? []
    existing.push(act)
    dayMap.set(act.day_date, existing)
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b))

  // Filter bookings by type for the summary section
  const accommodations = bookings.filter((b) => b.type === "accommodation")
  const transports = bookings.filter((b) => b.type === "transport")
  const dining = bookings.filter((b) => b.type === "dining")

  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="Tripletto" width={24} height={24} className="rounded-md" />
            <span className="font-serif text-base">Tripletto</span>
          </Link>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            Read-only view
          </span>
        </div>
      </header>

      {/* Cover */}
      <div className="relative h-40 w-full overflow-hidden sm:h-52">
        <Image src={cover} alt={`${trip.name} cover`} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6">
          <h1 className="font-serif text-2xl text-white sm:text-3xl">{trip.name}</h1>
        </div>
      </div>

      {/* Info bar */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm text-muted-foreground sm:px-6">
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
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">

        {/* Day-by-day itinerary */}
        {days.length > 0 && (
          <section>
            <h2 className="mb-5 font-serif text-xl">Itinerary</h2>
            <div className="space-y-8">
              {days.map(([date, acts], i) => (
                <div key={date}>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Day {i + 1} — {formatLongDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {acts.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <span className="mt-0.5 shrink-0 text-base" aria-hidden>
                          {CATEGORY_ICON[act.category] ?? "📍"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug">{act.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                            {act.start_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden />
                                {act.start_time.slice(0, 5)}
                              </span>
                            )}
                            {act.location && <span>{act.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Accommodations */}
        {accommodations.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl">Accommodation</h2>
            <div className="space-y-2">
              {accommodations.map((b) => {
                const d = b.details as Record<string, unknown> | null
                const address = d?.address as string | undefined
                return (
                  <div key={b.id} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="font-medium">🏨 {b.title}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      {b.booking_date && <span>Check-in: {formatLongDate(b.booking_date)}{b.check_in_time ? ` · ${b.check_in_time.slice(0, 5)}` : ""}</span>}
                      {b.check_out_date && <span>Check-out: {formatLongDate(b.check_out_date)}{b.check_out_time ? ` · ${b.check_out_time.slice(0, 5)}` : ""}</span>}
                      {address && <span>{address}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Transport */}
        {transports.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl">Transport</h2>
            <div className="space-y-2">
              {transports.map((b) => {
                const d = b.details as Record<string, unknown> | null
                const fromCity = d?.from_city as string | undefined
                const toCity = d?.to_city as string | undefined
                const fromCode = d?.from_code as string | undefined
                const toCode = d?.to_code as string | undefined
                const depTime = d?.departure_time as string | undefined
                const arrTime = d?.arrival_time as string | undefined
                const route = fromCode && toCode ? `${fromCode} → ${toCode}` : fromCity && toCity ? `${fromCity} → ${toCity}` : null
                return (
                  <div key={b.id} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="font-medium">✈️ {b.title || route || "Transport"}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      {route && b.title && <span>{route}</span>}
                      {depTime && <span>Dep: {formatDateTimeShort(depTime)}</span>}
                      {arrTime && <span>Arr: {formatDateTimeShort(arrTime)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Dining */}
        {dining.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl">Dining</h2>
            <div className="space-y-2">
              {dining.map((b) => {
                const d = b.details as Record<string, unknown> | null
                const datetime = d?.datetime as string | undefined
                const location = d?.location as string | undefined
                const partySize = d?.party_size as number | undefined
                return (
                  <div key={b.id} className="rounded-xl border border-border bg-card px-4 py-3">
                    <p className="font-medium">🍽️ {b.title}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      {datetime && <span>{formatDateTimeShort(datetime)}</span>}
                      {partySize && <span>{partySize} guests</span>}
                      {location && <span>{location}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Shared via{" "}
          <Link href="/" className="underline underline-offset-2">
            Tripletto
          </Link>{" "}
          · Read-only
        </p>
      </main>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTimeShort(dt: string): string {
  if (!dt) return ""
  try {
    const [datePart, timePart] = dt.includes("T") ? dt.split("T") : [dt, ""]
    const dateLabel = formatLongDate(datePart)
    const timeLabel = timePart ? timePart.slice(0, 5) : ""
    return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel
  } catch {
    return dt
  }
}
