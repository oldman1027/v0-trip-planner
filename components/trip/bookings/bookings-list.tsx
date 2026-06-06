"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Trash2, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BookingDrawer, type BookingSaveInput } from "./booking-drawer"
import { TransportDrawer } from "./transport-drawer"
import { createClient } from "@/lib/supabase/client"
import type { Booking } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useUndoDelete } from "@/hooks/use-undo-delete"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

// ── Type label ──────────────────────────────────────────────────────────────

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

// ── Constants / utils used by handleSave ────────────────────────────────────

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
  const base = {
    trip_id: tripId,
    position: 999,
    is_wishlist: false,
    cost_currency: currency,
    end_time: null as string | null,
  }

  if (input.type === "accommodation") {
    const startTime = input.check_in_time ?? null
    return {
      ...base, title: input.title, day_date: input.booking_date ?? null, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "accommodation" as const,
      location: (details.address as string | null) ?? null, cost_amount: input.amount ?? null,
    }
  }
  if (input.type === "transport") {
    const deptFull = (details.departure_time as string | null) ?? null
    const dayDate = deptFull ? deptFull.slice(0, 10) : (input.booking_date ?? null)
    const startTime = deptFull ? deptFull.slice(11, 16) : null
    return {
      ...base, title: input.title, day_date: dayDate, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "transport" as const,
      location: (details.from_city as string | null) ?? (details.from_code as string | null) ?? null,
      cost_amount: input.amount ?? null,
    }
  }
  if (input.type === "dining") {
    const datetime = (details.datetime as string) ?? ""
    const dayDate = datetime ? datetime.slice(0, 10) : null
    const startTime = datetime ? datetime.slice(11, 16) : null
    return {
      ...base, title: input.title, day_date: dayDate, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "food" as const,
      location: (details.location as string | null) ?? null, cost_amount: input.amount ?? null,
    }
  }
  if (input.type === "activities") {
    const startTime = input.departure_time ?? null
    return {
      ...base, title: input.title, day_date: input.booking_date ?? null, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "attraction" as const,
      location: (details.location as string | null) ?? null, cost_amount: input.amount ?? null,
    }
  }
  if (input.type === "other") {
    return {
      ...base, title: input.title, day_date: input.booking_date ?? null,
      start_time: null as string | null, time_block: "morning" as const,
      category: "other" as const, location: null as string | null, cost_amount: input.amount ?? null,
    }
  }
  return null
}

// ── Timeline helpers ─────────────────────────────────────────────────────────

function getPrimaryDate(b: Booking): string | null {
  if (b.type === "transport") {
    const d = (b.details ?? {}) as Record<string, unknown>
    const deptFull = d.departure_time as string | undefined
    if (deptFull) return deptFull.slice(0, 10)
  }
  if (b.type === "dining") {
    const d = (b.details ?? {}) as Record<string, unknown>
    const dt = d.datetime as string | undefined
    if (dt) return dt.slice(0, 10)
  }
  return b.booking_date
}

function getSortTime(b: Booking): string {
  if (b.type === "transport") {
    const d = (b.details ?? {}) as Record<string, unknown>
    const deptFull = d.departure_time as string | undefined
    if (deptFull?.includes("T")) return deptFull.slice(11, 16)
  }
  if (b.type === "accommodation") return b.check_in_time ?? "99:99"
  if (b.type === "dining") {
    const d = (b.details ?? {}) as Record<string, unknown>
    const dt = d.datetime as string | undefined
    if (dt?.includes("T")) return dt.slice(11, 16)
  }
  if (b.type === "activities") return b.departure_time ?? "99:99"
  return "99:99"
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  const month = date.toLocaleString("en-US", { month: "short" })
  const weekday = date.toLocaleString("en-US", { weekday: "long" })
  return `${month} ${d}, ${y} · ${weekday}`
}

function getSubtitle(b: Booking): string {
  const d = (b.details ?? {}) as Record<string, unknown>

  if (b.type === "transport") {
    const deptFull = d.departure_time as string | undefined
    const deptTime = deptFull?.includes("T") ? deptFull.slice(11, 16) : null
    const fromCode = (d.from_code as string | undefined)?.toUpperCase()
    const toCode = (d.to_code as string | undefined)?.toUpperCase()
    const fromCity = d.from_city as string | undefined
    const toCity = d.to_city as string | undefined
    const from = fromCode || fromCity
    const to = toCode || toCity
    const route = from && to ? `${from} → ${to}` : (from ?? to ?? null)
    return [deptTime, route].filter(Boolean).join(" · ")
  }

  if (b.type === "accommodation") {
    return b.check_in_time ? `Check-in ${b.check_in_time}` : "Check-in"
  }

  if (b.type === "dining") {
    const dt = d.datetime as string | undefined
    const time = dt?.includes("T") ? dt.slice(11, 16) : null
    const partySize = d.party_size != null ? `${d.party_size} guests` : null
    return [time, partySize].filter(Boolean).join(" · ")
  }

  if (b.type === "activities") {
    const time = b.departure_time ?? null
    const location = d.location as string | undefined
    return [time, location].filter(Boolean).join(" · ")
  }

  return ""
}

// ── Main component ───────────────────────────────────────────────────────────

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
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null)

  const { softDelete: softDeleteBooking } = useUndoDelete<Booking>()

  const drawerOpen = open !== null

  useKeyboardShortcuts(
    [{ key: "n", handler: () => setOpen("new") }],
    !drawerOpen,
  )

  useKeyboardShortcuts(
    [
      { key: "Delete", handler: () => focusedBookingId && handleDelete(focusedBookingId) },
      { key: "Backspace", handler: () => focusedBookingId && handleDelete(focusedBookingId) },
    ],
    !drawerOpen && focusedBookingId !== null,
  )

  const isTransportOpen =
    open !== null &&
    (open === "new" ? filter === "transport" : open.type === "transport")

  const transportBooking =
    open !== null && open !== "new" && isTransportOpen ? open : null

  const filtered = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((b) => b.type === filter)),
    [bookings, filter],
  )

  const { dateGroups, noDateBookings } = useMemo(() => {
    const dateMap = new Map<string, Booking[]>()
    const noDate: Booking[] = []

    for (const b of filtered) {
      const date = getPrimaryDate(b)
      if (!date) {
        noDate.push(b)
      } else {
        const arr = dateMap.get(date) ?? []
        arr.push(b)
        dateMap.set(date, arr)
      }
    }

    const groups = Array.from(dateMap.keys())
      .sort()
      .map((date) => ({
        date,
        bookings: (dateMap.get(date) ?? [])
          .slice()
          .sort((a, b) => getSortTime(a).localeCompare(getSortTime(b))),
      }))

    return { dateGroups: groups, noDateBookings: noDate }
  }, [filtered])

  const summary = useMemo(() => {
    const paid = filtered
      .filter((b) => b.payment_status === "paid" || b.payment_status === "confirmed")
      .reduce((sum, b) => sum + (b.amount ?? 0), 0)
    const outstanding = filtered
      .filter((b) => b.payment_status !== "paid" && b.payment_status !== "confirmed" && b.payment_status !== "cancelled")
      .reduce((sum, b) => sum + (b.amount ?? 0), 0)
    return { total: filtered.length, paid, outstanding }
  }, [filtered])

  async function handleSave(input: BookingSaveInput): Promise<string | undefined> {
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
        .insert({ ...bookingData, trip_id: tripId })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")

      if (addToItinerary) {
        const activityInsert = buildActivityInsert(bookingData, tripId, currency)
        if (activityInsert) {
          await supabase.from("activities").insert({
            ...activityInsert,
            linked_booking_id: (data as Booking).id,
          })
        }
      }

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
      return (data as Booking).id
    }
  }

  async function handleDelete(id: string) {
    const deletedBooking = bookings.find((b) => b.id === id)
    if (!deletedBooking) return
    setBookings((p) => p.filter((b) => b.id !== id))
    const linkedActivityId = (deletedBooking.details as Record<string, unknown> | null)?.activity_id as string | undefined
    softDeleteBooking(deletedBooking, {
      label: "Booking",
      onConfirm: async (b) => {
        const supabase = createClient()
        const { error } = await supabase.from("bookings").delete().eq("id", b.id)
        if (error) throw error
        if (linkedActivityId) {
          if (b.type === "dining") {
            await supabase.from("activities").delete().eq("id", linkedActivityId)
          } else {
            await supabase.from("activities").update({ booking_id: null }).eq("id", linkedActivityId)
          }
        }
      },
      onRestore: (b) => {
        setBookings((prev) => [...prev, b])
      },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filter tabs + Add button ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
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

        <Button
          className="rounded-xl bg-[#6D8F87] text-white hover:bg-[#5A7870]"
          onClick={() => setOpen("new")}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add booking
        </Button>
      </div>

      {/* ── Summary bar ── */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {summary.total} booking{summary.total !== 1 ? "s" : ""}
          {summary.paid > 0 && (
            <> · <span>{formatMoney(summary.paid, "THB")} paid</span></>
          )}
          {summary.outstanding > 0 && (
            <> · <span>{formatMoney(summary.outstanding, "THB")} pending</span></>
          )}
        </p>
      )}

      {/* ── Empty state ── */}
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
      ) : (
        /* ── Timeline ── */
        <div className="flex flex-col gap-8">
          {dateGroups.map((group) => (
            <section key={group.date}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {formatDateLabel(group.date)}
              </h3>
              <div className="flex flex-col gap-2">
                {group.bookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onEdit={() => { setFocusedBookingId(b.id); setOpen(b) }}
                    onDelete={() => handleDelete(b.id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {noDateBookings.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">No date set</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {noDateBookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onEdit={() => { setFocusedBookingId(b.id); setOpen(b) }}
                    onDelete={() => handleDelete(b.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
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
        tripId={tripId}
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

// ── BookingRow ───────────────────────────────────────────────────────────────

function BookingRow({
  booking: b,
  onEdit,
  onDelete,
}: {
  booking: Booking
  onEdit: () => void
  onDelete: () => void
}) {
  const typeLabel = getBookingTypeLabel(b)
  const subtitle = getSubtitle(b)
  const amountStr = b.amount != null ? formatMoney(b.amount, "THB") : "—"

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
      {/* Type label */}
      <span className="w-[108px] shrink-0 text-xs font-medium text-muted-foreground">
        {typeLabel}
      </span>

      {/* Name + subtitle */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold leading-snug">{b.title}</span>
        <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          {subtitle && <span>{subtitle}</span>}
          {b.confirmation_number ? (
            <span className={cn("text-green-600 dark:text-green-500", subtitle && "before:mr-1 before:content-['·']")}>
              Confirmed
            </span>
          ) : (
            <span className={cn("text-amber-500 dark:text-amber-400", subtitle && "before:mr-1 before:content-['·']")}>
              TBC
            </span>
          )}
        </div>
      </div>

      {/* Amount + status + actions */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="min-w-[72px] text-right text-sm font-medium tabular-nums text-foreground">
          {amountStr}
        </span>
        <div className="w-[52px] flex justify-center">
          <StatusBadge status={b.payment_status} />
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Edit booking"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete booking"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Booking["payment_status"] }) {
  if (status === "paid" || status === "confirmed") {
    return <span aria-label="Paid">✅</span>
  }
  if (status === "partial") {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
        Partial
      </span>
    )
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        Cancelled
      </span>
    )
  }
  return (
    <span className="rounded-full border border-transparent bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Pending
    </span>
  )
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string) {
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
