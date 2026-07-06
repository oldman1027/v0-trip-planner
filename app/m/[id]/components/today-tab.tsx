"use client"

import { useState, useMemo } from "react"
import { DollarSign } from "lucide-react"
import type { Activity, Booking, Expense, MemberWithProfile, Trip } from "@/lib/types"
import type { WeatherData } from "@/lib/weather"
import { daysBetween } from "@/lib/dates"
import { ActivityCard } from "@/components/trip/mobile/activity-card"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

const TIME_BLOCK_ORDER = ["morning", "afternoon", "night"] as const

export function TodayTab({
  trip,
  activities,
  expenses,
  members,
  weather,
  bookings = [],
}: {
  trip: Trip
  activities: Activity[]
  expenses: Expense[]
  members: MemberWithProfile[]
  weather: WeatherData | null
  bookings?: Booking[]
}) {
  const currency = trip.default_currency ?? "USD"
  const tripDays = daysBetween(trip.start_date, trip.end_date)

  const today = new Date().toISOString().slice(0, 10)
  const defaultDay = tripDays.find(d => d >= today) ?? tripDays[0] ?? today
  const [selectedDay, setSelectedDay] = useState(defaultDay)

  // Sort all activities for the day, then assign sequential numbers before grouping
  const dayActivities = useMemo(
    () =>
      activities
        .filter(a => a.day_date === selectedDay && !a.is_wishlist && !a.is_kiv)
        .sort((a, b) => {
          const blockOrder = { morning: 0, afternoon: 1, night: 2 }
          const ba = blockOrder[a.time_block ?? "morning"] ?? 0
          const bb = blockOrder[b.time_block ?? "morning"] ?? 0
          if (ba !== bb) return ba - bb
          return (a.start_time ?? "").localeCompare(b.start_time ?? "")
        }),
    [activities, selectedDay],
  )

  // Map id → global sequence number (1-based)
  const seqMap = useMemo(
    () => new Map(dayActivities.map((a, i) => [a.id, i + 1])),
    [dayActivities],
  )

  const dayExpenses = useMemo(
    () => expenses.filter(e => e.date === selectedDay),
    [expenses, selectedDay],
  )
  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)

  const grouped = TIME_BLOCK_ORDER.map(block => ({
    block,
    label: block.charAt(0).toUpperCase() + block.slice(1),
    items: dayActivities.filter(a => (a.time_block ?? "morning") === block),
  })).filter(g => g.items.length > 0)

  const weatherForDay = weather?.forecast?.find(f => f.date === selectedDay)
  const weatherLabel = weatherForDay
    ? `${weatherForDay.icon} ${Math.round(weatherForDay.high)}°C · ${weatherForDay.description}`
    : weather?.current
    ? `${weather.current.icon} ${weather.current.temperature}°C`
    : null

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-xl font-semibold" style={{ color: "#2C4A45" }}>
            {trip.name}
          </h1>
          <p className="text-xs" style={{ color: "#9BA8A6" }}>
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {weatherLabel ? ` · ${weatherLabel}` : ""}
          </p>
        </div>

        <div className="flex -space-x-2">
          {members.slice(0, 4).map(m => (
            <div
              key={m.user_id}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white"
              style={{ background: "#6D8F87" }}
              title={m.profile?.full_name ?? ""}
            >
              {(m.profile?.full_name ?? "?")[0]?.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Day pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {tripDays.map((d, i) => {
          const isSelected = d === selectedDay
          const isToday = d === today
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: isSelected ? "#6D8F87" : "#EDF5F2",
                color: isSelected ? "#FFFFFF" : "#6D8F87",
                minHeight: 32,
                outline: isToday && !isSelected ? "1.5px solid #6D8F87" : undefined,
              }}
            >
              Day {i + 1}
              {isToday ? " ·" : ""}
            </button>
          )
        })}
      </div>

      {/* Activity groups */}
      {grouped.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed py-12 text-center text-sm"
          style={{ borderColor: "#D4C9BC", color: "#9BA8A6" }}
        >
          No activities for this day yet
        </div>
      ) : (
        grouped.map(g => (
          <div key={g.block} className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
              {g.label}
            </p>
            {g.items.map(a => (
              <ActivityCard
                key={a.id}
                activity={a}
                seqNum={seqMap.get(a.id) ?? 0}
                currency={currency}
                bookings={bookings}
                members={members}
              />
            ))}
          </div>
        ))
      )}

      {/* Today's spend card */}
      {dayTotal > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "#EDF5F2", border: "0.5px solid #A9D6C5" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: "#6D8F87" }} />
              <span className="text-sm font-medium" style={{ color: "#2C4A45" }}>
                Today&apos;s spend
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
              {fmt(dayTotal, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "#6D8F87" }}>
            Bring at least {fmt(Math.ceil(dayTotal * 1.12), currency)} in cash (12% buffer)
          </p>
        </div>
      )}
    </div>
  )
}
