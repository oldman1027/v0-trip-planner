"use client"

import { useMemo, useState } from "react"
import { X, Pencil, MapPin, Clock, DollarSign } from "lucide-react"
import { CalendarView } from "./calendar-view"
import { ActivityDrawer } from "./activity-drawer"
import { BookingDrawer } from "@/components/trip/bookings/booking-drawer"
import { TransportDrawer } from "@/components/trip/bookings/transport-drawer"
import { TripMap } from "@/components/trip/overview/trip-map"
import { createClient } from "@/lib/supabase/client"
import { daysBetween, formatDayLabel } from "@/lib/dates"
import { toast } from "sonner"
import { useUndoDelete } from "@/hooks/use-undo-delete"
import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"
import type { Activity, Booking, TimeBlock, Trip } from "@/lib/types"

const CATEGORY_LABEL: Record<Activity["category"], string> = {
  food: "Food & Dining",
  attraction: "Attraction",
  transport: "Transport",
  accommodation: "Accommodation",
  shopping: "Shopping",
  entertainment: "Entertainment",
  other: "Other",
}

export function CalendarPageClient({
  trip,
  initialActivities,
}: {
  trip: Trip
  initialActivities: Activity[]
}) {
  const days = useMemo(
    () => daysBetween(trip.start_date, trip.end_date),
    [trip.start_date, trip.end_date],
  )

  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [drawerState, setDrawerState] = useState<
    | { mode: "create"; day_date: string; time_block: TimeBlock; start_time?: string }
    | { mode: "edit"; activity: Activity }
    | null
  >(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [transportOpen, setTransportOpen] = useState(false)

  const { softDelete: softDeleteActivity } = useUndoDelete<Activity>()

  async function handleSave(input: {
    id?: string
    day_date: string
    time_block: TimeBlock
    title: string
    location: string | null
    start_time: string | null
    end_time: string | null
    notes: string | null
    cost_amount: number | null
    photo_url: string | null
    category: Activity["category"]
    needs_booking: boolean
  }) {
    const supabase = createClient()

    if (input.id) {
      const { error } = await supabase
        .from("activities")
        .update({
          day_date: input.day_date,
          time_block: input.time_block,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          photo_url: input.photo_url,
          category: input.category,
        })
        .eq("id", input.id)
      if (error) throw error
      setActivities((prev) =>
        prev.map((a) => (a.id === input.id ? { ...a, ...input } : a)),
      )
      // Refresh sidebar if this was the selected activity
      if (selectedActivity?.id === input.id) {
        setSelectedActivity((prev) => (prev ? { ...prev, ...input } : prev))
      }
      toast.success("Activity updated")
    } else {
      const position = activities.filter(
        (a) => a.day_date === input.day_date && a.time_block === input.time_block,
      ).length
      const { data, error } = await supabase
        .from("activities")
        .insert({
          trip_id: trip.id,
          day_date: input.day_date,
          time_block: input.time_block,
          position,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          cost_currency: trip.default_currency ?? "USD",
          photo_url: input.photo_url,
          category: input.category,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setActivities((prev) => [...prev, data as Activity])
      toast.success("Activity added")
    }
  }

  async function handleDelete(id: string) {
    const activity = activities.find((a) => a.id === id)
    if (!activity) return
    setActivities((p) => p.filter((a) => a.id !== id))
    if (selectedActivity?.id === id) setSelectedActivity(null)
    softDeleteActivity(activity, {
      label: "Activity",
      onConfirm: async (act) => {
        const supabase = createClient()
        const { error } = await supabase.from("activities").delete().eq("id", act.id)
        if (error) throw error
      },
      onRestore: (act) => {
        setActivities((prev) => [...prev, act])
      },
    })
  }

  async function handleBookingSave(
    input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string },
  ): Promise<string | undefined> {
    const supabase = createClient()
    if (input.id) {
      const { error } = await supabase.from("bookings").update({ ...input }).eq("id", input.id)
      if (error) throw error
      toast.success("Booking updated")
      setBookingOpen(false)
      return undefined
    } else {
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, trip_id: trip.id })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      toast.success("Booking added")
      setBookingOpen(false)
      return (data as Booking).id
    }
  }

  async function handleBookingDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("bookings").delete().eq("id", id)
    if (error) throw error
    setBookingOpen(false)
    toast.success("Booking removed")
  }

  const currency = trip.default_currency ?? "USD"

  return (
    // Full-bleed breakout — escapes the page container's max-w-6xl + px-6
    <div className="-mx-6 -mt-4 flex flex-col" style={{ width: "calc(100% + 3rem)" }}>

      {/* ── Map panel (top ~52vh) ── */}
      <div style={{ height: "52vh", minHeight: 260 }} className="relative w-full shrink-0">
        <TripMap
          activities={activities}
          destination={trip.destination ?? null}
          days={days}
          className="absolute inset-0"
          containerClassName="h-full w-full"
        />
      </div>

      {/* ── Bottom panel: calendar + optional detail sidebar ── */}
      <div className="flex min-h-0 flex-1 border-t border-border bg-background">

        {/* Calendar grid — scrollable */}
        <div
          className="flex-1 min-w-0 overflow-y-auto px-4 py-4"
          style={{ maxHeight: "calc(100vh - 52vh - 56px)" }}
        >
          <CalendarView
            days={days}
            activities={activities}
            onActivityClick={(a) => setSelectedActivity(a)}
            onAddActivity={(day_date, start_time, time_block) =>
              setDrawerState({ mode: "create", day_date, time_block, start_time })
            }
            onAddBooking={() => setBookingOpen(true)}
            onAddTransport={() => setTransportOpen(true)}
          />
        </div>

        {/* Activity detail sidebar */}
        {selectedActivity && (
          <div
            className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card"
            style={{ maxHeight: "calc(100vh - 52vh - 56px)" }}
          >
            {/* Photo */}
            {selectedActivity.photo_url ? (
              <div className="relative h-40 w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedActivity.photo_url}
                  alt={selectedActivity.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            ) : (
              <div className="h-24 w-full bg-gradient-to-br from-emerald-100 to-teal-100" />
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-1">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 mb-0.5">
                  {CATEGORY_LABEL[selectedActivity.category] ?? "Activity"}
                </p>
                <h3 className="font-serif text-lg font-semibold leading-snug text-foreground">
                  {selectedActivity.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details */}
            <div className="space-y-2.5 px-4 pb-4 pt-2">
              {/* Day */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground">
                  {format(parseDateOnly(selectedActivity.day_date ?? days[0]), "EEE, MMM d")}
                </span>
                <span>·</span>
                <span className="capitalize">{selectedActivity.time_block}</span>
              </div>

              {/* Time */}
              {(selectedActivity.start_time || selectedActivity.end_time) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {selectedActivity.start_time?.slice(0, 5)}
                    {selectedActivity.end_time ? ` – ${selectedActivity.end_time.slice(0, 5)}` : ""}
                  </span>
                </div>
              )}

              {/* Location */}
              {selectedActivity.location && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{selectedActivity.location}</span>
                </div>
              )}

              {/* Cost */}
              {selectedActivity.cost_amount != null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {currency} {selectedActivity.cost_amount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Notes */}
              {selectedActivity.notes && (
                <div className="rounded-xl bg-secondary/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  {selectedActivity.notes}
                </div>
              )}

              {/* Edit button */}
              <button
                type="button"
                onClick={() => {
                  setDrawerState({ mode: "edit", activity: selectedActivity })
                  setSelectedActivity(null)
                }}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit activity
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawers ── */}
      <ActivityDrawer
        state={drawerState}
        days={days}
        currency={currency}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setDrawerState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <BookingDrawer
        open={bookingOpen}
        booking={null}
        tripId={trip.id}
        currency={currency}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setBookingOpen(false)}
        onSave={handleBookingSave}
        onDelete={handleBookingDelete}
      />

      <TransportDrawer
        open={transportOpen}
        booking={null}
        defaultType="transport"
        tripId={trip.id}
        currency={currency}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setTransportOpen(false)}
        onSave={handleBookingSave}
        onDelete={handleBookingDelete}
      />
    </div>
  )
}
