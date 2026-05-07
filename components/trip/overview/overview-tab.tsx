"use client"

import { useState } from "react"
import { Printer, MapPin, Clock, CalendarCheck, AlertTriangle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TripMap } from "@/components/trip/overview/trip-map"
import { cn } from "@/lib/utils"
import { daysBetween, formatDayLabel, formatLongDate } from "@/lib/dates"
import { deadlineUrgency, deadlineLabel, daysUntilBooking } from "@/lib/booking-urgency"
import type { Activity, Booking, Trip } from "@/lib/types"

const CATEGORY_LABELS: Record<Activity["category"], string> = {
  food: "Food & Dining",
  attraction: "Attraction",
  transport: "Transport",
  accommodation: "Accommodation",
  shopping: "Shopping",
  entertainment: "Entertainment",
  other: "Other",
}

const CATEGORY_BADGE: Record<Activity["category"], string> = {
  food: "bg-orange-100 text-orange-700 border-orange-200",
  attraction: "bg-blue-100 text-blue-700 border-blue-200",
  transport: "bg-slate-100 text-slate-700 border-slate-200",
  accommodation: "bg-purple-100 text-purple-700 border-purple-200",
  shopping: "bg-pink-100 text-pink-700 border-pink-200",
  entertainment: "bg-amber-100 text-amber-700 border-amber-200",
  other: "bg-secondary text-muted-foreground border-border",
}

const BOOKING_TYPE_ICON: Record<string, string> = {
  flight: "✈",
  hotel: "🏨",
  transport: "🚗",
}

const STATUS_BADGE: Record<Booking["payment_status"], string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

const TIME_BLOCK_ORDER: Record<string, number> = { morning: 0, afternoon: 1, night: 2 }

function formatTime(t: string | null): string | null {
  if (!t) return null
  return t.length >= 5 ? t.slice(0, 5) : t
}

function formatCost(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null
  const c = currency ?? "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${c} ${amount}`
  }
}

export function OverviewTab({
  trip,
  activities,
  bookings,
}: {
  trip: Trip
  activities: Activity[]
  bookings: Booking[]
}) {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)

  const days = daysBetween(trip.start_date, trip.end_date)

  const keyBookings = bookings.filter((b) => ["flight", "hotel", "transport"].includes(b.type))

  const sortedActivities = [...activities]
    .filter((a) => !a.is_wishlist && a.day_date)
    .sort((a, b) => {
      const dateCmp = (a.day_date ?? "").localeCompare(b.day_date ?? "")
      if (dateCmp !== 0) return dateCmp
      const blockCmp =
        (TIME_BLOCK_ORDER[a.time_block ?? "morning"] ?? 0) -
        (TIME_BLOCK_ORDER[b.time_block ?? "morning"] ?? 0)
      if (blockCmp !== 0) return blockCmp
      return a.position - b.position
    })

  const mappableActivities = sortedActivities.filter((a) => a.location)

  function toggleActivity(id: string) {
    setSelectedActivityId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-8 print:gap-6">
      {/* Print-only header */}
      <div className="hidden print:block border-b border-border pb-4 mb-2">
        <h1 className="text-2xl font-serif">{trip.name}</h1>
        {trip.destination && <p className="text-sm text-muted-foreground mt-1">{trip.destination}</p>}
        <p className="text-sm text-muted-foreground">
          {formatLongDate(trip.start_date)} – {formatLongDate(trip.end_date)}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end print:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Export PDF
        </Button>
      </div>

      {/* Key bookings */}
      {keyBookings.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-xl">Key Bookings</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keyBookings.map((b) => {
              const urgency = deadlineUrgency(b.cancellation_deadline)
              const dlLabel = deadlineLabel(b.cancellation_deadline)
              const daysAway = daysUntilBooking(b.booking_date)
              const upcoming = daysAway !== null && daysAway <= 7
              return (
                <Card
                  key={b.id}
                  className={cn(
                    "relative flex flex-col gap-2 overflow-hidden rounded-2xl border-border p-4",
                    urgency === "critical" && "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20",
                    urgency !== "critical" && upcoming && "border-sky-200 bg-sky-50/30 dark:border-sky-900 dark:bg-sky-950/10",
                  )}
                >
                  {/* Top accent strip */}
                  {(urgency === "critical" || upcoming) && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 top-0 h-1",
                        urgency === "critical" ? "bg-red-400" : "bg-sky-400",
                      )}
                    />
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                      <span aria-hidden>{BOOKING_TYPE_ICON[b.type]}</span>
                      {b.type}
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                        STATUS_BADGE[b.payment_status],
                      )}
                    >
                      {b.payment_status}
                    </span>
                  </div>

                  <div className="font-medium leading-tight">{b.title}</div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {b.booking_date && <span>{formatLongDate(b.booking_date)}</span>}
                    {b.amount != null && (
                      <span className="tabular">{formatCost(b.amount, b.currency)}</span>
                    )}
                  </div>

                  {/* Urgency chips */}
                  {(urgency || upcoming) && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {upcoming && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400">
                          <Calendar className="h-2.5 w-2.5" aria-hidden />
                          {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`}
                        </span>
                      )}
                      {urgency === "critical" && dlLabel && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-default items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                              Cancel · {dlLabel}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Free cancellation window closes soon. Check your booking for details.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {urgency === "warning" && dlLabel && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Cancel deadline · {dlLabel}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Day-by-day itinerary */}
      <section>
        <h2 className="mb-4 font-serif text-xl">Day-by-day Itinerary</h2>
        <div className="flex flex-col gap-8">
          {days.map((day, idx) => {
            const dayActs = sortedActivities.filter((a) => a.day_date === day)
            return (
              <div key={day} className="print:break-inside-avoid">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Day {idx + 1}
                  </span>
                  <span className="font-serif text-lg">{formatDayLabel(day)}</span>
                </div>

                {dayActs.length === 0 ? (
                  <p className="pl-4 text-sm italic text-muted-foreground">Nothing planned yet</p>
                ) : (
                  <ul className="flex flex-col gap-2 border-l-2 border-border pl-5">
                    {dayActs.map((a) => {
                      const isSelected = selectedActivityId === a.id
                      const hasPinnable = !!a.location
                      return (
                        <li
                          key={a.id}
                          className={cn(
                            "flex items-start gap-4 rounded-xl px-3 py-2.5 transition-colors",
                            hasPinnable
                              ? "cursor-pointer hover:bg-secondary/60"
                              : "cursor-default",
                            isSelected && "bg-secondary ring-1 ring-primary/20",
                          )}
                          onClick={hasPinnable ? () => toggleActivity(a.id) : undefined}
                          role={hasPinnable ? "button" : undefined}
                          tabIndex={hasPinnable ? 0 : undefined}
                          onKeyDown={
                            hasPinnable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") toggleActivity(a.id)
                                }
                              : undefined
                          }
                        >
                          {/* Time */}
                          <div className="w-12 shrink-0 pt-px text-right font-mono text-xs text-muted-foreground">
                            {formatTime(a.start_time) ?? (
                              <span className="capitalize">{a.time_block}</span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{a.title}</span>
                              {a.category && a.category !== "other" && CATEGORY_BADGE[a.category] && (
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                    CATEGORY_BADGE[a.category],
                                  )}
                                >
                                  {CATEGORY_LABELS[a.category]}
                                </span>
                              )}
                              {a.cost_amount != null && (
                                <span className="tabular text-xs text-muted-foreground">
                                  {formatCost(a.cost_amount, a.cost_currency)}
                                </span>
                              )}
                              {a.booking_id && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  <CalendarCheck className="h-2.5 w-2.5" aria-hidden />
                                  Booked
                                </span>
                              )}
                            </div>

                            {(a.location || (a.start_time && a.end_time)) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {a.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" aria-hidden />
                                    {a.location}
                                  </span>
                                )}
                                {a.start_time && a.end_time && (
                                  <span className="tabular inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" aria-hidden />
                                    {formatTime(a.start_time)} – {formatTime(a.end_time)}
                                  </span>
                                )}
                              </div>
                            )}

                            {a.notes && (
                              <p className="text-xs text-muted-foreground">{a.notes}</p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Map */}
      {mappableActivities.length > 0 && (
        <section className="print:hidden">
          <h2 className="mb-1 font-serif text-xl">Map</h2>
          {selectedActivityId && (
            <p className="mb-3 text-xs text-muted-foreground">
              Click an activity above to highlight it, or click a pin to select.
            </p>
          )}
          <TripMap
            activities={sortedActivities}
            destination={trip.destination}
            days={days}
            selectedActivityId={selectedActivityId}
          />
        </section>
      )}
    </div>
  )
}
