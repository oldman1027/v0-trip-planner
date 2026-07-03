"use client"

import { useState, useMemo } from "react"
import { MapPin, Clock, ChevronDown, ChevronUp, ExternalLink, DollarSign } from "lucide-react"
import type { Activity, Booking, Expense, MemberWithProfile, Trip } from "@/lib/types"
import type { WeatherData } from "@/lib/weather"
import { daysBetween } from "@/lib/dates"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function formatTime(t: string | null) {
  if (!t) return null
  return t.slice(0, 5)
}

const CATEGORY_COLORS: Record<string, string> = {
  accommodation: "#6D8F87",
  transport:     "#D97706",
  dining:        "#E85D75",
  experiences:   "#7C3AED",
  other:         "#94A3B8",
}

const TIME_BLOCK_ORDER = ["morning", "afternoon", "night"] as const

function ActivityRow({
  activity,
  currency,
  index,
}: {
  activity: Activity
  currency: string
  index: number
}) {
  const [open, setOpen] = useState(false)
  const dot = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other
  const mapsUrl = activity.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
    : null

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]"
        style={{ minHeight: 64 }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {/* index badge */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: dot }}
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
            <p className="truncate text-sm font-semibold" style={{ color: "#2C4A45" }}>
              {activity.title}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "#9BA8A6" }}>
            {(activity.start_time || activity.end_time) && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {formatTime(activity.start_time)}
                {activity.end_time ? ` – ${formatTime(activity.end_time)}` : ""}
              </span>
            )}
            {activity.location && (
              <>
                <span>·</span>
                <span className="truncate">{activity.location.split(",")[0]}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {activity.cost_amount && activity.cost_amount > 0 && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
              {fmt(activity.cost_amount, activity.cost_currency ?? currency)}
            </span>
          )}
          {activity.photo_url && (
            <img
              src={activity.photo_url}
              alt=""
              className="h-12 w-12 rounded-xl object-cover"
              loading="lazy"
            />
          )}
          {open ? (
            <ChevronUp className="h-4 w-4" style={{ color: "#9BA8A6" }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: "#9BA8A6" }} />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3" style={{ borderColor: "#E8E0D8", background: "#F5F0EA" }}>
          {activity.location && (
            <p className="text-xs" style={{ color: "#6D8F87" }}>
              <MapPin className="mr-1 inline h-3 w-3" />
              {activity.location}
            </p>
          )}
          {activity.notes && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6D8F87" }}>
              {activity.notes}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white"
                style={{ background: "#6D8F87", minHeight: 44 }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Maps
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function TodayTab({
  trip,
  activities,
  expenses,
  members,
  weather,
}: {
  trip: Trip
  activities: Activity[]
  expenses: Expense[]
  members: MemberWithProfile[]
  weather: WeatherData | null
}) {
  const currency = trip.default_currency ?? "USD"
  const tripDays = daysBetween(trip.start_date, trip.end_date)

  // Determine current active day (default to first trip day that is today or future)
  const today = new Date().toISOString().slice(0, 10)
  const defaultDay = tripDays.find(d => d >= today) ?? tripDays[0] ?? today
  const [selectedDay, setSelectedDay] = useState(defaultDay)

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

  // Weather for selected day
  const weatherForDay = weather?.forecast?.find(f => f.date === selectedDay)
  const weatherLabel = weatherForDay
    ? `${weatherForDay.icon} ${Math.round((weatherForDay.high * 9) / 5 + 32)}°F · ${weatherForDay.description}`
    : weather?.current
    ? `${weather.current.icon} ${weather.current.temperature}°F`
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

        {/* Member avatars */}
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
            {g.items.map((a, i) => (
              <ActivityRow key={a.id} activity={a} currency={currency} index={i} />
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
