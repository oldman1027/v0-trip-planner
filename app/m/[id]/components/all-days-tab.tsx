"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, MapPin, Clock, ExternalLink } from "lucide-react"
import type { Activity, Trip } from "@/lib/types"
import type { WeatherData } from "@/lib/weather"
import { daysBetween } from "@/lib/dates"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  accommodation: "#6D8F87",
  transport:     "#D97706",
  dining:        "#E85D75",
  experiences:   "#7C3AED",
  other:         "#94A3B8",
}

function ActivityRowCompact({
  activity,
  currency,
}: {
  activity: Activity
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const dot = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other
  const mapsUrl = activity.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
    : null

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03]"
        style={{ minHeight: 48 }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "#2C4A45" }}>
            {activity.title}
          </p>
          {activity.start_time && (
            <p className="text-[11px]" style={{ color: "#9BA8A6" }}>
              <Clock className="mr-0.5 inline h-2.5 w-2.5" />
              {activity.start_time.slice(0, 5)}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activity.cost_amount && activity.cost_amount > 0 && (
            <span className="text-xs tabular-nums" style={{ color: "#6D8F87" }}>
              {fmt(activity.cost_amount, activity.cost_currency ?? currency)}
            </span>
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" style={{ color: "#9BA8A6" }} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "#9BA8A6" }} />
          )}
        </div>
      </button>

      {open && (activity.location || activity.notes) && (
        <div className="px-3 pb-3 pt-0" style={{ background: "#F5F0EA" }}>
          {activity.location && (
            <p className="text-xs" style={{ color: "#6D8F87" }}>
              <MapPin className="mr-1 inline h-3 w-3" />
              {activity.location}
            </p>
          )}
          {activity.notes && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "#6D8F87" }}>
              {activity.notes}
            </p>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: "#6D8F87" }}
            >
              <ExternalLink className="h-3 w-3" />
              Open in Maps
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function AllDaysTab({
  trip,
  activities,
  weather,
}: {
  trip: Trip
  activities: Activity[]
  weather: WeatherData | null
}) {
  const currency = trip.default_currency ?? "USD"
  const tripDays = daysBetween(trip.start_date, trip.end_date)
  const today = new Date().toISOString().slice(0, 10)
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set([today]))

  function toggleDay(d: string) {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-4 pt-4">
      {tripDays.map((d, i) => {
        const dayActivities = activities
          .filter(a => a.day_date === d && !a.is_wishlist && !a.is_kiv)
          .sort((a, b) => {
            const blockOrder = { morning: 0, afternoon: 1, night: 2 }
            const ba = blockOrder[a.time_block ?? "morning"] ?? 0
            const bb = blockOrder[b.time_block ?? "morning"] ?? 0
            if (ba !== bb) return ba - bb
            return (a.start_time ?? "").localeCompare(b.start_time ?? "")
          })
        const isOpen = openDays.has(d)
        const isToday = d === today
        const dateLabel = new Date(d + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        const weatherDay = weather?.forecast?.find(f => f.date === d)

        return (
          <div key={d} className="overflow-hidden rounded-2xl border" style={{ borderColor: "#E8E0D8" }}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]"
              style={{ minHeight: 52, background: isToday ? "#EDF5F2" : "#FFFBF4" }}
              onClick={() => toggleDay(d)}
              aria-expanded={isOpen}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: isToday ? "#6D8F87" : "#B5C4C1" }}
                  >
                    Day {i + 1}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-medium" style={{ color: "#6D8F87" }}>
                      Today
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs" style={{ color: "#9BA8A6" }}>
                  {dateLabel}
                  {weatherDay ? ` · ${weatherDay.icon} ${Math.round((weatherDay.high * 9) / 5 + 32)}°F` : ""}
                  {" · "}
                  {dayActivities.length} {dayActivities.length === 1 ? "activity" : "activities"}
                </p>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#9BA8A6" }} />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#9BA8A6" }} />
              )}
            </button>

            {isOpen && (
              <div className="divide-y divide-[#E8E0D8]">
                {dayActivities.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: "#9BA8A6" }}>
                    No activities planned yet
                  </p>
                ) : (
                  dayActivities.map(a => (
                    <ActivityRowCompact key={a.id} activity={a} currency={currency} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
