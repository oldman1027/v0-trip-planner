import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, MapPin, Calendar } from "lucide-react"
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
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
      </div>

      <div className="mx-auto -mt-20 w-full max-w-6xl px-6">
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur-sm md:flex-row md:items-start md:justify-between md:gap-8">
          <nav aria-label="Breadcrumb" className="inline-flex -mx-6 px-6 pt-0 -mt-6 pb-4 border-b border-border/50 md:border-b-0 md:-mx-0 md:px-0 md:-mt-0 md:pb-0">
            <ol className="flex items-center gap-2">
              <li>
                <Link
                  href="/trips"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  <span>All trips</span>
                </Link>
              </li>
              <li aria-current="page" className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground mr-2" aria-hidden>/</span>
                {trip.name}
              </li>
            </ol>
          </nav>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{trip.name}</h1>
                  {trip.is_sample ? <SampleBadge /> : null}
                </div>
              </div>
              <TripActionsMenu tripId={trip.id} isSample={trip.is_sample} />
            </div>

            <div className="flex flex-col gap-2 text-sm md:flex-row md:gap-6">
              {trip.destination ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="font-medium">{trip.destination}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span className="tabular font-medium">{formatRange(trip.start_date, trip.end_date)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SampleBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-secondary/30">
      Sample trip
    </span>
  )
}
