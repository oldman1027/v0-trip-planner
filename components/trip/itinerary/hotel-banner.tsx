import { Hotel, MapPin, Clock } from "lucide-react"
import type { Activity, Booking } from "@/lib/types"

export function HotelBanner({
  activity,
  booking,
}: {
  activity: Activity
  booking?: Booking
}) {
  const mapsUrl = activity.location
    ? `https://maps.google.com?q=${encodeURIComponent(activity.location)}`
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Hotel className="h-4 w-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{activity.title}</span>
            {booking && (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Booked
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {(activity.start_time || activity.end_time) && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {activity.start_time && `In: ${fmtTime(activity.start_time)}`}
                {activity.start_time && activity.end_time && " · "}
                {activity.end_time && `Out: ${fmtTime(activity.end_time)}`}
              </span>
            )}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-3 w-3" aria-hidden />
                {activity.location}
              </a>
            ) : activity.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {activity.location}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return time
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}
