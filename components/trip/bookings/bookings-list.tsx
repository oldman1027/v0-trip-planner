"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Trash2, Ticket, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BookingDrawer, type BookingSaveInput } from "./booking-drawer"
import { TransportDrawer } from "./transport-drawer"
import { createClient } from "@/lib/supabase/client"
import { recordHistory } from "@/lib/trip-history"
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
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "dining" as const,
      location: (details.location as string | null) ?? null, cost_amount: input.amount ?? null,
    }
  }
  if (input.type === "activities") {
    const startTime = input.departure_time ?? null
    return {
      ...base, title: input.title, day_date: input.booking_date ?? null, start_time: startTime,
      time_block: startTime ? getTimeBlock(startTime) : "morning", category: "experiences" as const,
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
    const arrFull = d.arrival_time as string | undefined
    const deptTime = deptFull?.includes("T") ? deptFull.slice(11, 16) : null
    const arrTime = arrFull?.includes("T") ? arrFull.slice(11, 16) : null
    const timeRange = deptTime && arrTime
      ? `${deptTime} → ${arrTime}`
      : deptTime ?? null
    const fromCode = (d.from_code as string | undefined)?.toUpperCase()
    const toCode = (d.to_code as string | undefined)?.toUpperCase()
    const fromCity = d.from_city as string | undefined
    const toCity = d.to_city as string | undefined
    const from = fromCode || fromCity
    const to = toCode || toCity
    const route = from && to ? `${from} → ${to}` : (from ?? to ?? null)
    return [timeRange, route].filter(Boolean).join(" · ")
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
  const currentUserRef = useRef<{ id: string; name: string } | null>(null)

  const { softDelete: softDeleteBooking } = useUndoDelete<Booking>()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
      currentUserRef.current = {
        id: user.id,
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "Someone",
      }
    })
  }, [])

  function maybeRecord(
    action: Parameters<typeof recordHistory>[0]["action"],
    entityType: Parameters<typeof recordHistory>[0]["entityType"],
    entityName: string,
  ) {
    const user = currentUserRef.current
    if (!user) return
    void recordHistory({
      supabase: createClient(),
      tripId,
      userId: user.id,
      userName: user.name,
      action,
      entityType,
      entityName,
    }).catch(() => null)
  }

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
          reservation_status: bookingData.reservation_status,
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

      // Resolve linked activity: prefer linked_booking_id lookup, fall back to legacy details.activity_id
      let editActivityId = editDetails.activity_id as string | undefined
      if (!editActivityId && bookingData.id) {
        const { data: linked } = await supabase
          .from("activities")
          .select("id")
          .eq("linked_booking_id", bookingData.id)
          .maybeSingle()
        editActivityId = linked?.id
      }

      if (editActivityId) {
        if (bookingData.type === "transport") {
          const deptFull = (editDetails.departure_time as string | null) ?? null
          const arrFull = (editDetails.arrival_time as string | null) ?? null
          const dayDate = deptFull ? deptFull.slice(0, 10) : null
          const startTime = deptFull ? deptFull.slice(11, 16) : null
          const endTime = arrFull ? arrFull.slice(11, 16) : null
          const timeBlock = startTime ? getTimeBlock(startTime) : "morning"
          await supabase.from("activities").update({
            title: bookingData.title,
            day_date: dayDate,
            start_time: startTime,
            end_time: endTime,
            time_block: timeBlock,
            location: (editDetails.from_city as string | null) ?? (editDetails.from_code as string | null) ?? null,
            cost_amount: bookingData.amount ?? null,
          }).eq("id", editActivityId)
        } else if (bookingData.type === "dining") {
          const datetime = (editDetails.datetime as string) ?? ""
          const dayDate = datetime ? datetime.slice(0, 10) : null
          const startTime = datetime ? datetime.slice(11, 16) : null
          const timeBlock = startTime ? getTimeBlock(startTime) : "morning"
          await supabase.from("activities").update({
            title: bookingData.title,
            location: (editDetails.location as string | null) ?? null,
            day_date: dayDate,
            time_block: timeBlock,
            start_time: startTime,
          }).eq("id", editActivityId)
        } else if (bookingData.type === "accommodation") {
          await supabase.from("activities").update({
            title: bookingData.title,
            day_date: bookingData.booking_date ?? null,
            start_time: bookingData.check_in_time ?? null,
            end_time: bookingData.check_out_time ?? null,
            time_block: bookingData.check_in_time ? getTimeBlock(bookingData.check_in_time) : "morning",
            location: (editDetails.address as string | null) ?? null,
            cost_amount: bookingData.amount ?? null,
          }).eq("id", editActivityId)
        } else if (bookingData.type === "activities") {
          await supabase.from("activities").update({
            title: bookingData.title,
            day_date: bookingData.booking_date ?? null,
            start_time: bookingData.departure_time ?? null,
            time_block: bookingData.departure_time ? getTimeBlock(bookingData.departure_time) : "morning",
            location: (editDetails.location as string | null) ?? null,
            cost_amount: bookingData.amount ?? null,
          }).eq("id", editActivityId)
        } else {
          await supabase.from("activities").update({
            title: bookingData.title,
            cost_amount: bookingData.amount ?? null,
          }).eq("id", editActivityId)
        }
      }

      // Keep the linked expense in sync when booking amount/date changes
      if (bookingData.amount) {
        await supabase
          .from("expenses")
          .update({
            amount: bookingData.amount,
            currency: bookingData.currency ?? currency,
            description: bookingData.title,
            date: bookingData.booking_date ?? new Date().toISOString().slice(0, 10),
            category: EXPENSE_CATEGORY_MAP[bookingData.type as keyof typeof EXPENSE_CATEGORY_MAP] ?? "other",
          })
          .eq("booking_id", bookingData.id!)
          .eq("source_type", "booking")
      }

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingData.id ? ({ ...b, ...bookingData, id: bookingData.id! } as Booking) : b,
        ),
      )
      toast.success("Booking updated")
      maybeRecord("edited", "booking", bookingData.title)
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
          const { data: { user: actUser } } = await supabase.auth.getUser()
          await supabase.from("activities").insert({
            ...activityInsert,
            linked_booking_id: (data as Booking).id,
            created_by: actUser?.id ?? null,
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
      maybeRecord("added", "booking", bookingData.title)
      return (data as Booking).id
    }
  }

  async function handleToggleReservation(id: string, newStatus: "confirmed" | "tbc") {
    setBookings((prev) =>
      prev.map((b) => b.id === id ? { ...b, reservation_status: newStatus } : b),
    )
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("bookings")
        .update({ reservation_status: newStatus })
        .eq("id", id)
      if (error) throw error
      toast.success(newStatus === "confirmed" ? "Marked as Confirmed" : "Marked as TBC")
    } catch {
      setBookings((prev) =>
        prev.map((b) => b.id === id ? { ...b, reservation_status: newStatus === "confirmed" ? "tbc" : "confirmed" } : b),
      )
      toast.error("Could not update status")
    }
  }

  async function handleDelete(id: string) {
    const deletedBooking = bookings.find((b) => b.id === id)
    if (!deletedBooking) return
    setBookings((p) => p.filter((b) => b.id !== id))
    softDeleteBooking(deletedBooking, {
      label: "Booking",
      onConfirm: async (b) => {
        const supabase = createClient()
        // Resolve linked activity: prefer linked_booking_id lookup, fall back to legacy details.activity_id
        let linkedActivityId = (b.details as Record<string, unknown> | null)?.activity_id as string | undefined
        if (!linkedActivityId) {
          const { data: linked } = await supabase
            .from("activities")
            .select("id")
            .eq("linked_booking_id", b.id)
            .maybeSingle()
          linkedActivityId = linked?.id
        }
        // Clear/remove the activity link before deleting the booking — the FK has no cascade
        if (linkedActivityId) {
          if (b.type === "dining") {
            await supabase.from("activities").delete().eq("id", linkedActivityId)
          } else {
            await supabase.from("activities").update({ linked_booking_id: null }).eq("id", linkedActivityId)
          }
        }
        const { error } = await supabase.from("bookings").delete().eq("id", b.id)
        if (error) throw error
        maybeRecord("deleted", "booking", b.title)
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
                    onToggle={handleToggleReservation}
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
                    onToggle={handleToggleReservation}
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
  onToggle,
}: {
  booking: Booking
  onEdit: () => void
  onDelete: () => void
  onToggle: (id: string, newStatus: "confirmed" | "tbc") => void
}) {
  const typeLabel = getBookingTypeLabel(b)
  const subtitle = getSubtitle(b)
  const amountStr = b.amount != null ? formatMoney(b.amount, "THB") : "—"
  const rs = getReservationStatus(b)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/30"
    >
      {/* Type label */}
      <span className="w-[108px] shrink-0 text-xs font-medium text-muted-foreground">
        {typeLabel}
      </span>

      {/* Name + subtitle */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold leading-snug">{b.title}</span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>

      {/* Amount · status text · toggle · delete */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="min-w-[72px] text-right text-sm font-medium tabular-nums text-foreground">
          {amountStr}
        </span>
        <ReservationStatusText status={rs} />
        {rs !== "cancelled" && (
          <QuickToggle
            isConfirmed={rs === "confirmed"}
            onToggle={() => onToggle(b.id, rs === "confirmed" ? "tbc" : "confirmed")}
          />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete booking"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Reservation status helper ─────────────────────────────────────────────────

function getReservationStatus(booking: Pick<Booking, "confirmation_number" | "payment_status" | "reservation_status">) {
  const hasConfirmationNumber = !!booking.confirmation_number?.trim()
  // Use reservation_status if set; fall back to payment_status for pre-migration rows
  const rs = booking.reservation_status ?? booking.payment_status
  if (rs === "cancelled") return "cancelled" as const
  if (hasConfirmationNumber || rs === "confirmed") return "confirmed" as const
  if (rs === "pending") return "pending" as const
  return "tbc" as const
}

// ── Reservation status text ───────────────────────────────────────────────────

function ReservationStatusText({ status }: { status: "confirmed" | "pending" | "tbc" | "cancelled" }) {
  const map = {
    confirmed: { label: "Confirmed", cls: "text-green-600 dark:text-green-500" },
    pending:   { label: "Pending",   cls: "text-amber-500 dark:text-amber-400" },
    tbc:       { label: "TBC",       cls: "text-amber-500 dark:text-amber-400" },
    cancelled: { label: "Cancelled", cls: "text-red-500 dark:text-red-400" },
  }
  const { label, cls } = map[status] ?? map.tbc
  return <span className={cn("w-[68px] text-right text-xs font-medium", cls)}>{label}</span>
}

// ── Quick toggle ──────────────────────────────────────────────────────────────

function QuickToggle({ isConfirmed, onToggle }: { isConfirmed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      title={isConfirmed ? "Mark as TBC" : "Mark as Confirmed"}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
        isConfirmed
          ? "border-green-500 bg-green-50 text-green-600 hover:border-red-300 hover:bg-red-50 hover:text-red-400 dark:bg-green-900/20"
          : "border-border bg-background text-transparent hover:border-green-400 hover:text-green-400",
      )}
      aria-label={isConfirmed ? "Mark as TBC" : "Mark as Confirmed"}
    >
      <Check className="h-3 w-3" />
    </button>
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
