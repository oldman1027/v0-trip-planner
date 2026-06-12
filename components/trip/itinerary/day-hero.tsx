"use client"

import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"
import type { Activity, Trip } from "@/lib/types"

export function DayHero({
  dayIndex,
  day,
  activities,
  trip,
  weather,
}: {
  dayIndex: number
  day: string
  activities: Activity[]
  trip: Trip
  weather?: { icon: string; high: number; rainChance: number }
}) {
  const heroPhoto =
    activities.find((a) => a.photo_url?.startsWith("https://"))?.photo_url ??
    trip.cover_image_url

  const cityName =
    activities
      .filter((a) => a.location && !a.is_wishlist && !a.is_kiv)
      .sort((a, b) => (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99"))[0]
      ?.location?.split(",")[0]
      ?.trim() ?? trip.destination

  const date = parseDateOnly(day)
  const activityCount = activities.filter((a) => !a.is_wishlist && !a.is_kiv).length
  const daySpend = activities.reduce((sum, a) => sum + (a.cost_amount ?? 0), 0)

  return (
    <div>
      {/* Hero image */}
      <div className="relative h-44 overflow-hidden">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#A9D6C5]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Overlay text */}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
            DAY {dayIndex} · {format(date, "EEE, MMM d").toUpperCase()}
          </p>
          {cityName && (
            <p className="mt-0.5 font-serif text-2xl font-bold text-white leading-tight">
              {cityName}
            </p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-5 px-4 py-2.5 overflow-x-auto"
        style={{ background: "#F7F3EE", borderBottom: "0.5px solid #D4C9BC" }}
      >
        {weather && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-base leading-none">{weather.icon}</span>
            <span className="text-sm font-medium text-[#2C4A45]">{weather.high}°C</span>
            {weather.rainChance > 20 && (
              <span className="text-xs text-[#6B7C77]">{weather.rainChance}% rain</span>
            )}
          </div>
        )}
        <div className="shrink-0 text-xs text-[#6B7C77]">
          {activityCount} {activityCount === 1 ? "activity" : "activities"}
        </div>
        {daySpend > 0 && (
          <div className="shrink-0 text-xs text-[#6B7C77]">
            {fmtCost(daySpend, trip.default_currency ?? "USD")} est. spend
          </div>
        )}
      </div>
    </div>
  )
}

function fmtCost(amount: number, currency: string) {
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
