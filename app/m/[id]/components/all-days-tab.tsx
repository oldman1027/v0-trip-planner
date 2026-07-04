"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Activity, Booking, MemberWithProfile, Trip } from "@/lib/types"
import type { WeatherData } from "@/lib/weather"
import { daysBetween } from "@/lib/dates"
import { ActivityCardCompact } from "@/components/trip/mobile/activity-card"

function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort((a, b) => {
    const blockOrder = { morning: 0, afternoon: 1, night: 2 }
    const ba = blockOrder[a.time_block ?? "morning"] ?? 0
    const bb = blockOrder[b.time_block ?? "morning"] ?? 0
    if (ba !== bb) return ba - bb
    return (a.start_time ?? "").localeCompare(b.start_time ?? "")
  })
}

export function AllDaysTab({
  trip,
  activities,
  weather,
  bookings = [],
  members = [],
}: {
  trip: Trip
  activities: Activity[]
  weather: WeatherData | null
  bookings?: Booking[]
  members?: MemberWithProfile[]
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
        const dayActivities = sortActivities(
          activities.filter(a => a.day_date === d && !a.is_wishlist && !a.is_kiv)
        )
        // Sequential numbers across full day (1..N)
        const seqMap = new Map(dayActivities.map((a, idx) => [a.id, idx + 1]))

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
                    <ActivityCardCompact
                      key={a.id}
                      activity={a}
                      seqNum={seqMap.get(a.id) ?? 0}
                      currency={currency}
                      bookings={bookings}
                      members={members}
                    />
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
