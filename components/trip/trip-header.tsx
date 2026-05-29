import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, MapPin, Calendar, DollarSign } from "lucide-react"
import { formatRange, tripDuration } from "@/lib/dates"
import { TripActionsMenu } from "./trip-actions-menu"
import { TripHeroActions } from "./trip-hero-actions"
import type { Trip } from "@/lib/types"

export function TripHeader({
  trip,
  totalBudget = 0,
  isOwner = false,
}: {
  trip: Trip
  totalBudget?: number
  isOwner?: boolean
}) {
  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"
  const duration = tripDuration(trip.start_date, trip.end_date)

  return (
    <>
      {/* Cover image */}
      <div className="relative h-36 w-full overflow-hidden md:h-48">
        <Image
          src={cover || "/placeholder.svg"}
          alt={`${trip.name} cover`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-xs text-white/70 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            All trips
          </Link>
          <div className="mt-1 flex items-end gap-2.5">
            <h1 className="font-serif text-3xl tracking-tight text-white md:text-4xl">{trip.name}</h1>
            {trip.is_sample ? <SampleBadge /> : null}
          </div>
        </div>
      </div>

      {/* Info bar — scrolls with page */}
      <div className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {trip.destination ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{trip.destination}</span>
                </span>
              ) : null}
              <span className="tabular flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {formatRange(trip.start_date, trip.end_date)}
              </span>
              <span>
                {duration} {duration === 1 ? "day" : "days"}
              </span>
              {totalBudget > 0 ? (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {fmtBudget(totalBudget, trip.default_currency)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {trip.default_currency}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TripHeroActions trip={trip} isOwner={isOwner} />
              <TripActionsMenu trip={trip} isSample={trip.is_sample} isOwner={isOwner} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SampleBadge() {
  return (
    <span className="mb-0.5 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/30">
      Sample
    </span>
  )
}

function fmtBudget(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
