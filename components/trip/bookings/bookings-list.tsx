"use client"

import { useMemo, useState } from "react"
import { Plus, Hotel, Plane, Bus, Ticket, Utensils, Star, AlertTriangle, Calendar } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BookingDrawer } from "./booking-drawer"
import { TransportDrawer } from "./transport-drawer"
import { createClient } from "@/lib/supabase/client"
import { deadlineUrgency, deadlineLabel, daysUntilBooking } from "@/lib/booking-urgency"
import type { Booking } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TYPE_META: Record<Booking["type"], { label: string; icon: typeof Hotel }> = {
  hotel:      { label: "Hotel",       icon: Hotel },
  flight:     { label: "Flight",      icon: Plane },
  transport:  { label: "Transport",   icon: Bus },
  other:      { label: "Other",       icon: Ticket },
  restaurant: { label: "Restaurant",  icon: Utensils },
  experience: { label: "Experience",  icon: Star },
}

function getTimeBlock(time: string): "morning" | "afternoon" | "night" {
  const hour = parseInt(time.slice(0, 2), 10)
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  return "night"
}

export function BookingsList({
  tripId,
  initialBookings,
  currency,
  tripStart,
  tripEnd,
}: {
  tripId: string
  initialBookings: Booking[]
  currency: string
  tripStart: string
  tripEnd: string
}) {
  const [bookings, setBookings] = useState(initialBookings)
  const [filter, setFilter] = useState<string>("all")
  const [open, setOpen] = useState<Booking | "new" | null>(null)

  const isTransportOpen =
    open !== null &&
    (open === "new"
      ? filter === "transport" || filter === "flight"
      : open.type === "transport" || open.type === "flight")

  const defaultTransportType: "transport" | "flight" =
    open === "new" && filter === "flight" ? "flight" : "transport"

  const transportBooking =
    open !== null && open !== "new" && isTransportOpen ? open : null

  const filtered = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((b) => b.type === filter)),
    [bookings, filter],
  )

  async function handleSave(input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }) {
    const supabase = createClient()

    const isLinked = !!(input.details as Record<string, unknown> | null)?.activity_id
    if (!isLinked && input.booking_date && tripStart && tripEnd) {
      if (input.booking_date < tripStart || input.booking_date > tripEnd) {
        throw new Error("Invalid booking date: outside trip range")
      }
    }

    if (input.id) {
      const { error } = await supabase
        .from("bookings")
        .update({
          type: input.type,
          title: input.title,
          details: input.details,
          amount: input.amount,
          currency: input.currency,
          payment_status: input.payment_status,
          cancellation_deadline: input.cancellation_deadline,
          booking_date: input.booking_date,
        })
        .eq("id", input.id)
      if (error) throw error

      const editDetails = (input.details ?? {}) as Record<string, unknown>
      const editActivityId = editDetails.activity_id as string | undefined
      if (editActivityId) {
        if (input.type === "restaurant") {
          const datetime = (editDetails.datetime as string) ?? ""
          const dayDate = datetime ? datetime.slice(0, 10) : null
          const startTime = datetime ? datetime.slice(11, 16) : null
          const timeBlock = startTime ? getTimeBlock(startTime) : "morning"
          await supabase
            .from("activities")
            .update({
              title: input.title,
              location: (editDetails.location as string | null) ?? null,
              day_date: dayDate,
              time_block: timeBlock,
              start_time: startTime,
            })
            .eq("id", editActivityId)
        } else {
          await supabase
            .from("activities")
            .update({ title: input.title, cost_amount: input.amount })
            .eq("id", editActivityId)
        }
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === input.id ? ({ ...b, ...input, id: input.id! } as Booking) : b)),
      )
      toast.success("Booking updated")
    } else {
      let bookingDetails = input.details

      if (input.type === "restaurant") {
        const d = (input.details ?? {}) as Record<string, unknown>
        const datetime = (d.datetime as string) ?? ""
        const dayDate = datetime ? datetime.slice(0, 10) : null
        const startTime = datetime ? datetime.slice(11, 16) : null
        const timeBlock = startTime ? getTimeBlock(startTime) : "morning"

        const { data: newActivity, error: activityError } = await supabase
          .from("activities")
          .insert({
            trip_id: tripId,
            day_date: dayDate,
            time_block: timeBlock,
            position: 999,
            title: input.title,
            location: (d.location as string | null) ?? null,
            start_time: startTime,
            end_time: null,
            category: "food",
            cost_currency: currency,
            is_wishlist: false,
          })
          .select()
          .single()

        if (!activityError && newActivity) {
          bookingDetails = { ...(d as Record<string, unknown>), activity_id: newActivity.id }
        }
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, trip_id: tripId, details: bookingDetails })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")

      if (input.type === "restaurant") {
        const activityId = (bookingDetails as Record<string, unknown> | null)?.activity_id as string | undefined
        if (activityId) {
          await supabase.from("activities").update({ booking_id: (data as Booking).id }).eq("id", activityId)
        }
      }

      setBookings((prev) => [data as Booking, ...prev])
      toast.success("Booking added")
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const prev = bookings
    const deletedBooking = bookings.find((b) => b.id === id)
    setBookings((p) => p.filter((b) => b.id !== id))
    const { error } = await supabase.from("bookings").delete().eq("id", id)
    if (error) {
      setBookings(prev)
      toast.error("Could not delete booking")
      throw error
    }
    const linkedActivityId = (deletedBooking?.details as Record<string, unknown> | null)?.activity_id as string | undefined
    if (linkedActivityId) {
      if (deletedBooking?.type === "restaurant") {
        await supabase.from("activities").delete().eq("id", linkedActivityId)
      } else {
        await supabase.from("activities").update({ booking_id: null }).eq("id", linkedActivityId)
      }
    }
    toast.success("Booking removed")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-1"
        >
          {[
            { v: "all",        l: "All" },
            { v: "hotel",      l: "Hotels" },
            { v: "flight",     l: "Flights" },
            { v: "transport",  l: "Transport" },
            { v: "restaurant", l: "Restaurant" },
            { v: "experience", l: "Experiences" },
            { v: "other",      l: "Other" },
          ].map((t) => (
            <ToggleGroupItem
              key={t.v}
              value={t.v}
              className="rounded-lg px-3 py-1.5 text-sm data-[state=on]:bg-secondary data-[state=on]:text-primary"
            >
              {t.l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button className="rounded-xl" onClick={() => setOpen("new")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add booking
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-primary">
              <Ticket className="h-6 w-6" aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="font-serif text-2xl">No bookings yet</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Track hotels, flights, and reservations in one place — with payment status and cancellation alerts.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="rounded-2xl border-border">
          <ul className="divide-y divide-border">
            {filtered.map((b) => {
              const Icon = TYPE_META[b.type].icon
              const urgency = deadlineUrgency(b.cancellation_deadline)
              const dlLabel = deadlineLabel(b.cancellation_deadline)
              const daysAway = daysUntilBooking(b.booking_date)
              const upcoming = daysAway !== null && daysAway <= 7

              const restaurantDetails =
                b.type === "restaurant" ? ((b.details ?? {}) as Record<string, unknown>) : null
              const restaurantSubtitle = restaurantDetails
                ? [
                    restaurantDetails.datetime
                      ? new Date(restaurantDetails.datetime as string).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : null,
                    restaurantDetails.party_size != null
                      ? `${restaurantDetails.party_size} guests`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : null

              return (
                <li
                  key={b.id}
                  className={cn(
                    "relative overflow-hidden",
                    urgency === "critical" && "bg-red-50/40 dark:bg-red-950/20",
                    urgency !== "critical" && upcoming && "bg-sky-50/30 dark:bg-sky-950/10",
                  )}
                >
                  {/* Left accent stripe */}
                  {(urgency === "critical" || upcoming) && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-1",
                        urgency === "critical" ? "bg-red-400" : "bg-sky-400",
                      )}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(b)}
                    className="flex w-full items-center gap-4 px-5 py-4 pl-6 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="font-medium leading-snug">{b.title}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="capitalize">{TYPE_META[b.type].label}</span>
                        {restaurantSubtitle && <span>{restaurantSubtitle}</span>}

                        {/* Upcoming chip */}
                        {upcoming && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400">
                            <Calendar className="h-2.5 w-2.5" aria-hidden />
                            {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`}
                          </span>
                        )}

                        {/* Deadline indicator */}
                        {urgency === "critical" && dlLabel && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                                <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                                Cancel · {dlLabel}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Free cancellation deadline is approaching. Act now to avoid charges.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {urgency === "warning" && dlLabel && (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            Cancel by {new Date(b.cancellation_deadline!).toLocaleDateString()} · {dlLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {b.amount != null && (
                        <span className="tabular text-sm font-medium">
                          {formatMoney(b.amount, b.currency ?? "USD")}
                        </span>
                      )}
                      <PaymentBadge status={b.payment_status} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <BookingDrawer
        open={open !== null && !isTransportOpen}
        booking={open === "new" || isTransportOpen ? null : open}
        currency={currency}
        tripStart={tripStart}
        tripEnd={tripEnd}
        onClose={() => setOpen(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <TransportDrawer
        open={isTransportOpen}
        booking={transportBooking}
        defaultType={defaultTransportType}
        currency={currency}
        tripStart={tripStart}
        tripEnd={tripEnd}
        onClose={() => setOpen(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}

function PaymentBadge({ status }: { status: Booking["payment_status"] }) {
  const styles =
    status === "paid" || status === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
      : status === "partial"
        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
        : status === "cancelled"
          ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          : "bg-secondary text-muted-foreground border border-transparent"
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", styles)}>
      {status}
    </span>
  )
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
