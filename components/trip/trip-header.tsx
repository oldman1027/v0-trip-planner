import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, MapPin } from "lucide-react"
import { formatRange } from "@/lib/dates"
import { TripActionsMenu } from "./trip-actions-menu"
import type { Trip } from "@/lib/types"

export function TripHeader({ trip }: { trip: Trip }) {
  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"

  return (
    <section className="relative">
      <div className="relative h-56 w-full overflow-hidden md:h-72">
        <Image src={cover || "/placeholder.svg"} alt={`${trip.name} cover`} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
      </div>

      <div className="mx-auto -mt-20 w-full max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card/95 p-6 shadow-md backdrop-blur">
          <div className="flex flex-col gap-2">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              All trips
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl tracking-tight md:text-4xl">{trip.name}</h1>
              {trip.is_sample ? <SampleBadge /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {trip.destination ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {trip.destination}
                </span>
              ) : null}
              <span className="tabular">{formatRange(trip.start_date, trip.end_date)}</span>
            </div>
          </div>

          <TripActionsMenu tripId={trip.id} isSample={trip.is_sample} />
        </div>
      </div>
    </section>
  )
}

function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      Sample trip
    </span>
  )
}
