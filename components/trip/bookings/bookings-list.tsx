"use client"

import { useMemo, useState } from "react"
import { Plus, Hotel, Bus, Plane, Utensils, Star, Package, AlertTriangle, Calendar, List, LayoutGrid, Ticket, Paperclip } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BookingDrawer, type BookingSaveInput } from "./booking-drawer"
import { TransportDrawer } from "./transport-drawer"
import { BookingCardView } from "./booking-card-view"
import { createClient } from "@/lib/supabase/client"
import { deadlineUrgency, deadlineLabel, daysUntilBooking } from "@/lib/booking-urgency"
import type { Booking } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function getBookingTypeLabel(booking: Booking): string {
  if (booking.type === "transport") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    return d.transport_type === "flight" ? "Flight" : "Transport"
  }
  const labels: Record<Booking["type"], string> = {
    accommodation: "Accommodation",
    transport: "Transport",
    dining: "Dining",
    activities: "Activity",
    other: "Other",
  }
  return labels[booking.type] ?? "Other"
}

function getBookingIcon(booking: Booking) {
  if (booking.type === "transport") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    return d.transport_type === "flight" ? Plane : Bus
  }
  const icons: Record<Booking["type"], typeof Hotel> = {
    accommodation: Hotel,
    transport: Bus,
    dining: Utensils,
    activities: Star,
    other: Package,
  }
  return icons[booking.type] ?? Package
}

const EXPENSE_CATEGORY_MAP = {
  accommodation: "accommodation",
  transport: "transport",
  dining: "food",
  activities: "activities",
  other: "other",
} as const

function getTimeBlock(time: string): "morning" | "afternoon" | "night" {
  const hour = parseInt(time.slice(0, 2), 10)
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  return "night"
}

function buildActivityInsert(
  input: Omit<BookingSaveInput, "trackInCosts" | "addToItinerary">,
  tripId: string,
  currency: string,
) {
  const details = (input.details ?? {}) as Record<string, unknown>
  const base = { trip_id: tripId, position: 999, is_wishlist: false, cost_currency: currency, end_time: null as string | null }

  if (input.type === "accommodation") {
    const startTime = input.check_in_time ?? null
    return { ...base, title: input.title, day_date: input.booking_date ?? null, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "accommodation" as const,
      location: (details.address as string | null) ?? null, cost_amount: input.amount ?? null }
  }

  if (input.type === "transport") {
    const deptFull = (details.departure_time as string | null) ?? null
    const dayDate = deptFull ? deptFull.slice(0, 10) : (input.booking_date ?? null)
    const startTime = deptFull ? deptFull.slice(11, 16) : null
    return { ...base, title: input.title, day_date: dayDate, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "transport" as const,
      location: (details.from_city as string | null) ?? (details.from_code as string | null) ?? null,
      cost_amount: input.amount ?? null }
  }

  if (input.type === "dining") {
    const datetime = (details.datetime as string) ?? ""
    const dayDate = datetime ? datetime.slice(0, 10) : null
    const startTime = datetime ? datetime.slice(11, 16) : null
    return { ...base, title: input.title, day_date: dayDate, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "food" as const,
      location: (details.location as string | null) ?? null, cost_amount: input.amount ?? null }
  }

  if (input.type === "activities") {
    const startTime = input.departure_time ?? null
    return { ...base, title: input.title, day_date: input.booking_date ?? null, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "attraction" as const,
      location: (details.location as string | null) ?? null, cost_amount: input.amount ?? null }
  }

  if (input.type === "other") {
    return { ...base, title: input.title, day_date: input.booking_date ?? null, start_time: null as string | null,
      time_block: "morning" as const, category: "other" as const, location: null as string | null,
      cost_amount: input.amount ?? null }
  }

  return null
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
  const [view, setView] = useState<"list" | "card">("list")
  const [open, setOpen] = useState<Booking | "new" | null>(null)

  const isTransportOpen =
    open !== null &&
    (open === "new"
      ? filter === "transport"
      : open.type === "transport")

  const transportBooking =
    open !== null && open !== "new" && isTransportOpen ? open : null

  const filtered = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((b) => b.type === filter)),
    [bookings, filter],
  )

  async function handleSave(input: BookingSaveInput) {
    const supabase = createClient()
    const { trackInCosts, addToItinerary, ...bookingData } = input

    const isLinked = !!(bookingData.details as Record<string, unknown> | null)?.activity_id
    if (!isLinked && bookingData.booking_date && tripStart && tripEnd) {
      if (bookingData.booking_date < tripStart || bookingData.booking_date > tripEnd) {
        throw new Error("Invalid booking date: outside trip range")
      }
    }

    if (bookingData.id) {
      const { error } = await supabase
        .from("bookings")
        .update({
          type: bookingData.type,
          title: bookingData.title,
          details: bookingData.details,
          amount: bookingData.amount,
          currency: bookingData.currency,
          payment_status: bookingData.payment_status,
          cancellation_deadline: bookingData.cancellation_deadline,
          booking_date: bookingData.booking_date,
          confirmation_number: bookingData.confirmation_number,
          booking_url: bookingData.booking_url,
          check_in_time: bookingData.check_in_time,
          check_out_time: bookingData.check_out_time,
          check_out_date: bookingData.check_out_date,
          departure_time: bookingData.departure_time,
          arrival_time: bookingData.arrival_time,
        })
        .eq("id", bookingData.id)
      if (error) throw error

      const editDetails = (bookingData.details ?? {}) as Record<string, unknown>
      const editActivityId = editDetails.activity_id as string | undefined
      if (editActivityId) {
        if (bookingData.type === "dining") {
          const datetime = (editDetails.datetime as string) ?? ""
          const dayDate = datetime ? datetime.slice(0, 10) : null
          const startTime = datetime ? datetime.slice(11, 16) : null
          const timeBlock = startTime ? getTimeBlock(startTime) : "morning"
          await supabase
            .from("activities")
            .update({
              title: bookingData.title,
              location: (editDetails.location as string | null) ?? null,
              day_date: dayDate,
              time_block: timeBlock,
              start_time: startTime,
            })
            .eq("id", editActivityId)
        } else {
          await supabase
            .from("activities")
            .update({ title: bookingData.title, cost_amount: bookingData.amount })
            .eq("id", editActivityId)
        }
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingData.id ? ({ ...b, ...bookingData, id: bookingData.id! } as Booking) : b,
        ),
      )
      toast.success("Booking updated")
    } else {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          ...bookingData,
          trip_id: tripId,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")

      // Create matching itinerary activity if requested
      if (addToItinerary) {
        const activityInsert = buildActivityInsert(bookingData, tripId, currency)
        if (activityInsert) {
          await supabase.from("activities").insert({
            ...activityInsert,
            linked_booking_id: (data as Booking).id,
          })
        }
      }

      // Create linked expense if requested
      if (trackInCosts && bookingData.amount) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from("expenses").insert({
            trip_id: tripId,
            booking_id: (data as Booking).id,
            amount: bookingData.amount,
            currency: bookingData.currency ?? currency,
            category: EXPENSE_CATEGORY_MAP[bookingData.type as keyof typeof EXPENSE_CATEGORY_MAP] ?? "other",
            date: bookingData.booking_date ?? new Date().toISOString().slice(0, 10),
            description: bookingData.title,
            paid_by_user_id: user.id,
          })
        }
      }

      setBookings((prev) => [data as Booking, ...prev])
      toast.success(trackInCosts && bookingData.amount ? "Booking added and expense created" : "Booking added")
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
      if (deletedBooking?.type === "dining") {
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
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { v: "all",           l: "All" },
            { v: "accommodation", l: "Accommodation" },
            { v: "transport",     l: "Transport" },
            { v: "dining",        l: "Dining" },
            { v: "activities",    l: "Activities" },
            { v: "other",         l: "Other" },
          ].map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setFilter(t.v)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                filter === t.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("card")}
              aria-label="Card view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                view === "card"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>

          <Button className="rounded-xl bg-[#27ba76] text-white hover:bg-[#27ba76]/90" onClick={() => setOpen("new")}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add booking
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-primary">
              <Ticket className="h-6 w-6" aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="font-serif text-2xl">No bookings yet</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Track accommodation, transport, dining, and activities in one place — with payment status and cancellation alerts.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === "card" ? (
        <BookingCardView
          bookings={filtered}
          onEdit={(b) => setOpen(b)}
          onDelete={handleDelete}
        />
      ) : (
        <Card className="rounded-2xl border-border">
          <ul className="divide-y divide-border">
            {filtered.map((b) => {
              const Icon = getBookingIcon(b)
              const urgency = deadlineUrgency(b.cancellation_deadline)
              const dlLabel = deadlineLabel(b.cancellation_deadline)
              const daysAway = daysUntilBooking(b.booking_date)
              const upcoming = daysAway !== null && daysAway <= 7

              const diningDetails =
                b.type === "dining" ? ((b.details ?? {}) as Record<string, unknown>) : null
              const diningSubtitle = diningDetails
                ? [
                    diningDetails.datetime
                      ? new Date(diningDetails.datetime as string).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : null,
                    diningDetails.party_size != null
                      ? `${diningDetails.party_size} guests`
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
                        <span>{getBookingTypeLabel(b)}</span>
                        {b.confirmation_number && (
                          <span className="font-mono">#{b.confirmation_number}</span>
                        )}
                        {diningSubtitle && <span>{diningSubtitle}</span>}
                        {(b.booking_attachments?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" aria-hidden />
                            {b.booking_attachments!.length}
                          </span>
                        )}

                        {upcoming && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400">
                            <Calendar className="h-2.5 w-2.5" aria-hidden />
                            {daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`}
                          </span>
                        )}

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
        booking={open === "new" || isTransportOpen ? null : (open as Booking | null)}
        tripId={tripId}
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
      ? "bg-[#27ba76]/15 text-[#27ba76] border border-[#27ba76]/30"
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
