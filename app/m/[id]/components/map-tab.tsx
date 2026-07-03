"use client"

import { ExternalLink, MapPin } from "lucide-react"
import type { Activity, Trip } from "@/lib/types"
import { daysBetween } from "@/lib/dates"

export function MapTab({
  trip,
  activities,
}: {
  trip: Trip
  activities: Activity[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const tripDays = daysBetween(trip.start_date, trip.end_date)
  const activeDay = tripDays.find(d => d >= today) ?? tripDays[0] ?? today

  const todayActivities = activities
    .filter(a => a.day_date === activeDay && !a.is_wishlist && !a.is_kiv && a.location)
    .sort((a, b) => {
      const blockOrder = { morning: 0, afternoon: 1, night: 2 }
      return (blockOrder[a.time_block ?? "morning"] ?? 0) - (blockOrder[b.time_block ?? "morning"] ?? 0)
    })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Build a multi-marker iframe URL using the first activity as center
  const firstLocation = todayActivities[0]?.location ?? trip.destination ?? ""
  const mapSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(
        todayActivities.map(a => a.location!).join("|") || (trip.destination ?? ""),
      )}&zoom=13`
    : null

  const allLocationsQuery = todayActivities
    .map(a => a.location!)
    .filter(Boolean)
    .join(" to ")
  const mapsAppUrl = allLocationsQuery
    ? `https://www.google.com/maps/dir/${todayActivities.map(a => encodeURIComponent(a.location!)).join("/")}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination ?? "")}`

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: "#2C4A45" }}>
          Today&apos;s locations
        </p>
        <a
          href={mapsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white"
          style={{ background: "#6D8F87", minHeight: 36 }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Maps
        </a>
      </div>

      {/* Map embed */}
      {mapSrc ? (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "#E8E0D8" }}>
          <iframe
            src={mapSrc}
            width="100%"
            height="340"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Today's map"
          />
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center"
          style={{ borderColor: "#E8E0D8", background: "#F5F0EA" }}
        >
          <MapPin className="h-8 w-8" style={{ color: "#D4C9BC" }} />
          <p className="text-sm" style={{ color: "#9BA8A6" }}>Map unavailable</p>
          <a
            href={mapsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl px-4 py-2 text-xs font-medium text-white"
            style={{ background: "#6D8F87" }}
          >
            Open Google Maps
          </a>
        </div>
      )}

      {/* Location list with numbered pins */}
      {todayActivities.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
            Stops today
          </p>
          {todayActivities.map((a, i) => (
            <a
              key={a.id}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location!)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              style={{ borderColor: "#E8E0D8", background: "#FFFBF4", minHeight: 56 }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "#6D8F87" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: "#2C4A45" }}>
                  {a.title}
                </p>
                <p className="truncate text-xs" style={{ color: "#9BA8A6" }}>
                  {a.location}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "#9BA8A6" }} />
            </a>
          ))}
        </div>
      )}

      {todayActivities.length === 0 && (
        <div
          className="rounded-2xl border border-dashed py-10 text-center text-sm"
          style={{ borderColor: "#D4C9BC", color: "#9BA8A6" }}
        >
          No locations for today yet
        </div>
      )}
    </div>
  )
}
