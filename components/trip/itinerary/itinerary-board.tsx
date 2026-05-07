"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Calendar, LayoutGrid, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DaySidebar } from "./day-sidebar"
import { TimeBlockColumn } from "./time-block-column"
import { ActivityCard } from "./activity-card"
import { ActivityDrawer } from "./activity-drawer"
import { CalendarView } from "./calendar-view"
import { HotelBanner } from "./hotel-banner"
import { BookingDrawer } from "@/components/trip/bookings/booking-drawer"
import { TransportDrawer } from "@/components/trip/bookings/transport-drawer"
import { TripMap } from "@/components/trip/overview/trip-map"
import { TriplettoAI } from "@/components/trip/TriplettoAI"
import { createClient } from "@/lib/supabase/client"
import { moveActivity, reorderActivities } from "@/app/actions/move-activity"
import { daysBetween } from "@/lib/dates"
import { detectConflicts } from "@/lib/time-conflicts"
import { geocodeDestination, fetchWeatherForecast } from "@/lib/weather"
import type { Activity, Booking, TimeBlock, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type BlockKey = `${string}::${TimeBlock}`
type ViewMode = "board" | "calendar"

const CATEGORY_FILTERS: { value: Activity["category"]; label: string }[] = [
  { value: "food",          label: "Food & Dining" },
  { value: "attraction",    label: "Attraction" },
  { value: "transport",     label: "Transport" },
  { value: "accommodation", label: "Accommodation" },
  { value: "shopping",      label: "Shopping" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other",         label: "Other" },
]

function categoryToBookingType(cat: Activity["category"]): Booking["type"] {
  if (cat === "food") return "restaurant"
  if (cat === "accommodation") return "hotel"
  if (cat === "transport") return "transport"
  if (cat === "attraction" || cat === "entertainment" || cat === "shopping") return "experience"
  return "other"
}

const TIME_BLOCKS: TimeBlock[] = ["morning", "afternoon", "night"]

export function ItineraryBoard({
  trip,
  initialActivities,
  initialBookings,
}: {
  trip: Trip
  initialActivities: Activity[]
  initialBookings: Booking[]
}) {
  const days = useMemo(() => daysBetween(trip.start_date, trip.end_date), [trip.start_date, trip.end_date])

  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [selectedDay, setSelectedDay] = useState<string>(days[0])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [activeCategories, setActiveCategories] = useState<Set<Activity["category"]>>(new Set())
  const [drawerState, setDrawerState] = useState<
    | { mode: "create"; day_date: string; time_block: TimeBlock; start_time?: string }
    | { mode: "edit"; activity: Activity }
    | null
  >(null)
  const [bookingOpen, setBookingOpen] = useState<Booking | null>(null)
  const [calendarSelectedId, setCalendarSelectedId] = useState<string | null>(null)
  const [calendarBookingOpen, setCalendarBookingOpen] = useState(false)
  const [calendarTransportOpen, setCalendarTransportOpen] = useState(false)

  const conflicts = useMemo(() => detectConflicts(activities), [activities])

  // Weather per day for sidebar chips
  const [weatherByDay, setWeatherByDay] = useState<Map<string, { icon: string; high: number }>>(new Map())
  useEffect(() => {
    if (!trip.destination) return
    let cancelled = false
    async function load() {
      const coords = await geocodeDestination(trip.destination!)
      if (!coords || cancelled) return
      const data = await fetchWeatherForecast(coords.latitude, coords.longitude, trip.destination!)
      if (!data || cancelled) return
      const map = new Map<string, { icon: string; high: number }>()
      for (const d of data.forecast) map.set(d.date, { icon: d.icon, high: d.high })
      setWeatherByDay(map)
    }
    load()
    return () => { cancelled = true }
  }, [trip.destination])

  // Map activity_id → booking for cross-referencing the "Booked" badge
  const activityBookingMap = useMemo(() => {
    const m = new Map<string, Booking>()
    for (const b of bookings) {
      const aid = (b.details as Record<string, unknown> | null)?.activity_id
      if (typeof aid === "string") m.set(aid, b)
    }
    return m
  }, [bookings])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Prefer day cards when the pointer is physically inside them, fall back to
  // closestCorners for same-day block movement. This fixes cross-day drag:
  // closestCorners alone picks time-block columns (large panels) over the small
  // day-strip buttons because the dragged card body overlaps the columns.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    const dayCard = pointerCollisions.find(({ id }) => String(id).startsWith("day::"))
    if (dayCard) return [dayCard]
    return closestCorners(args)
  }, [])

  // Group activities into block buckets keyed by `${day}::${block}` (exclude wishlist items)
  const buckets = useMemo(() => {
    const out = new Map<BlockKey, Activity[]>()
    for (const day of days) {
      for (const block of TIME_BLOCKS) {
        out.set(`${day}::${block}`, [])
      }
    }
    for (const a of activities) {
      if (!a.is_wishlist && a.day_date && a.time_block) {
        if (activeCategories.size > 0 && !activeCategories.has(a.category)) continue
        const key = `${a.day_date}::${a.time_block}` as BlockKey
        const list = out.get(key)
        if (list) list.push(a)
      }
    }
    for (const list of out.values()) list.sort((a, b) => a.position - b.position)
    return out
  }, [activities, days, activeCategories])

  const dayCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const day of days) c.set(day, 0)
    for (const a of activities) {
      if (a.day_date && !a.is_wishlist) c.set(a.day_date, (c.get(a.day_date) ?? 0) + 1)
    }
    return c
  }, [activities, days])

  // Hotel activity per day for the banner shown above time-block columns
  const hotelByDay = useMemo(() => {
    const m = new Map<string, { activity: Activity; booking: Booking | undefined }>()
    for (const a of activities) {
      if (a.category === "accommodation" && !a.is_wishlist && a.day_date && !m.has(a.day_date)) {
        m.set(a.day_date, { activity: a, booking: activityBookingMap.get(a.id) })
      }
    }
    return m
  }, [activities, activityBookingMap])

  // Keyboard navigation for day strip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return
      const idx = days.indexOf(selectedDay)
      if ((e.key === "ArrowRight" || e.key === "ArrowDown") && idx < days.length - 1) {
        e.preventDefault()
        setSelectedDay(days[idx + 1])
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && idx > 0) {
        e.preventDefault()
        setSelectedDay(days[idx - 1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [days, selectedDay])

  function findActivity(id: string) {
    return activities.find((a) => a.id === id) ?? null
  }

  function findContainer(id: string): BlockKey | null {
    if (!id) return null
    if (id.includes("::")) return id as BlockKey
    if (id.startsWith("day::")) return null
    const a = findActivity(id)
    if (!a) return null
    return `${a.day_date}::${a.time_block}` as BlockKey
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return
    if (overIdStr.startsWith("day::")) return // handled on drop

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return
    if (activeContainer === overContainer) return

    // Move card to a new container during hover
    const [day, block] = overContainer.split("::") as [string, TimeBlock]
    setActivities((prev) =>
      prev.map((a) => (a.id === activeIdStr ? { ...a, day_date: day, time_block: block } : a)),
    )
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const moved = findActivity(activeIdStr)
    if (!moved) return

    // Drop on a day card → drop into morning block of that day
    if (overIdStr.startsWith("day::")) {
      const day = overIdStr.replace("day::", "")
      if (day !== moved.day_date || moved.time_block !== "morning") {
        setSelectedDay(day)
        await applyMove(activeIdStr, day, "morning", 0)
      }
      return
    }

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return

    const [overDay, overBlock] = overContainer.split("::") as [string, TimeBlock]

    // If dropped on a block container directly (empty zone)
    if (overIdStr === overContainer) {
      await applyMove(activeIdStr, overDay, overBlock, buckets.get(overContainer)?.length ?? 0)
      return
    }

    // Reorder within container, possibly moved across containers in onDragOver
    const list = activities
      .filter((a) => a.day_date === overDay && a.time_block === overBlock)
      .sort((a, b) => a.position - b.position)
    const overIndex = list.findIndex((a) => a.id === overIdStr)
    const activeIndex = list.findIndex((a) => a.id === activeIdStr)

    let newIndex = overIndex
    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      // dnd-kit semantics: reorder
      newIndex = overIndex
    } else if (activeIndex === -1) {
      newIndex = overIndex
    }

    await applyMove(activeIdStr, overDay, overBlock, newIndex)
  }

  async function applyMove(activityId: string, day: string, block: TimeBlock, targetIndex: number) {
    // Reorder optimistically: build new bucket order
    setActivities((prev) => {
      const updated = prev.map((a) => (a.id === activityId ? { ...a, day_date: day, time_block: block } : a))
      const inBucket = updated
        .filter((a) => a.day_date === day && a.time_block === block)
        .sort((a, b) => (a.id === activityId ? -0.5 : a.position) - (b.id === activityId ? -0.5 : b.position))
      // Remove the moving one from its current position
      const without = inBucket.filter((a) => a.id !== activityId)
      const moving = inBucket.find((a) => a.id === activityId)
      if (!moving) return updated
      const clamped = Math.max(0, Math.min(targetIndex, without.length))
      const reordered = [...without.slice(0, clamped), moving, ...without.slice(clamped)]
      const positionMap = new Map(reordered.map((a, idx) => [a.id, idx]))
      return updated.map((a) =>
        a.day_date === day && a.time_block === block ? { ...a, position: positionMap.get(a.id) ?? a.position } : a,
      )
    })

    // Persist using server action
    try {
      // Update the moved activity itself
      await moveActivity(activityId, day, block, targetIndex)

      // Renumber the bucket positions for stability
      setActivities((latest) => {
        const bucket = latest
          .filter((a) => a.day_date === day && a.time_block === block)
          .sort((a, b) => a.position - b.position)
        // Fire-and-forget renumber for the bucket
        reorderActivities(bucket.map((a, idx) => ({ id: a.id, position: idx }))).catch(() => null)
        return latest
      })
    } catch (err) {
      toast.error("Could not save order", { description: err instanceof Error ? err.message : "Unknown" })
    }
  }

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
    if (input.day_date < trip.start_date || input.day_date > trip.end_date) {
      throw new Error("Invalid activity date: outside trip range")
    }
    const supabase = createClient()
    if (input.id) {
      // Edit existing activity
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

      // Sync linked booking if it exists
      const existingBooking = activityBookingMap.get(input.id)
      let resolvedBookingId: string | null = existingBooking?.id ?? null
      if (input.needs_booking) {
        if (existingBooking) {
          if (existingBooking.type === "restaurant") {
            // Sync restaurant-specific fields back to the booking
            const existingDetails = (existingBooking.details ?? {}) as Record<string, unknown>
            const newDatetime =
              input.day_date && input.start_time
                ? `${input.day_date}T${input.start_time}`
                : (existingDetails.datetime as string | undefined) ?? null
            const newDetails: Record<string, unknown> = {
              ...existingDetails,
              restaurant_name: input.title,
              location: input.location,
              datetime: newDatetime,
            }
            await supabase
              .from("bookings")
              .update({ title: input.title, details: newDetails })
              .eq("id", existingBooking.id)
            setBookings((prev) =>
              prev.map((b) =>
                b.id === existingBooking.id ? { ...b, title: input.title, details: newDetails } : b,
              ),
            )
          } else {
            // Update the linked booking
            await supabase
              .from("bookings")
              .update({
                title: input.title,
                amount: input.cost_amount,
                type: categoryToBookingType(input.category),
              })
              .eq("id", existingBooking.id)
            setBookings((prev) =>
              prev.map((b) =>
                b.id === existingBooking.id
                  ? { ...b, title: input.title, amount: input.cost_amount, type: categoryToBookingType(input.category) }
                  : b,
              ),
            )
          }
        } else {
          // Create new linked booking
          const { data: newBooking } = await supabase
            .from("bookings")
            .insert({
              trip_id: trip.id,
              type: categoryToBookingType(input.category),
              title: input.title,
              amount: input.cost_amount,
              currency: trip.default_currency ?? "USD",
              payment_status: "pending",
              details: { activity_id: input.id },
            })
            .select()
            .single()
          if (newBooking) {
            resolvedBookingId = (newBooking as Booking).id
            await supabase.from("activities").update({ booking_id: resolvedBookingId }).eq("id", input.id!)
            setBookings((prev) => [newBooking as Booking, ...prev])
          }
        }
      } else if (existingBooking) {
        // User unchecked "needs booking" — delete the linked booking and clear activity.booking_id
        resolvedBookingId = null
        await supabase.from("bookings").delete().eq("id", existingBooking.id)
        await supabase.from("activities").update({ booking_id: null }).eq("id", input.id!)
        setBookings((prev) => prev.filter((b) => b.id !== existingBooking.id))
      }

      setActivities((prev) =>
        prev.map((a) => (a.id === input.id ? { ...a, ...input, booking_id: resolvedBookingId } : a)),
      )
      toast.success("Activity updated")
    } else {
      // Create new activity
      const targetIndex = (buckets.get(`${input.day_date}::${input.time_block}` as BlockKey) ?? []).length
      const { data, error } = await supabase
        .from("activities")
        .insert({
          trip_id: trip.id,
          day_date: input.day_date,
          time_block: input.time_block,
          position: targetIndex,
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
      const newActivity = data as Activity
      setActivities((prev) => [...prev, newActivity])

      // Auto-create booking if requested
      if (input.needs_booking) {
        const { data: newBooking } = await supabase
          .from("bookings")
          .insert({
            trip_id: trip.id,
            type: categoryToBookingType(input.category),
            title: input.title,
            amount: input.cost_amount,
            currency: trip.default_currency ?? "USD",
            payment_status: "pending",
            details: { activity_id: newActivity.id },
            booking_date: input.day_date,
          })
          .select()
          .single()
        if (newBooking) {
          // Link the activity back to the booking
          await supabase.from("activities").update({ booking_id: (newBooking as Booking).id }).eq("id", newActivity.id)
          setActivities((prev) =>
            prev.map((a) => (a.id === newActivity.id ? { ...a, booking_id: (newBooking as Booking).id } : a)),
          )
          setBookings((prev) => [newBooking as Booking, ...prev])
        }
      }

      toast.success("Activity added")
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const prev = activities
    const linkedBooking = activityBookingMap.get(id)
    setActivities((p) => p.filter((a) => a.id !== id))
    const { error } = await supabase.from("activities").delete().eq("id", id)
    if (error) {
      setActivities(prev)
      toast.error("Could not delete")
      throw error
    }
    if (linkedBooking) {
      await supabase.from("bookings").delete().eq("id", linkedBooking.id)
      setBookings((prev) => prev.filter((b) => b.id !== linkedBooking.id))
    }
    toast.success("Activity removed")
  }

  async function handleBookingSave(input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }) {
    const supabase = createClient()
    if (!input.id) return
    // All bookings opened from the itinerary board are activity-linked;
    // the trigger auto-corrects their booking_date. Still validate standalone ones.
    const isLinked = !!(input.details as Record<string, unknown> | null)?.activity_id
    if (!isLinked && input.booking_date) {
      if (input.booking_date < trip.start_date || input.booking_date > trip.end_date) {
        throw new Error("Invalid booking date: outside trip range")
      }
    }
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
    // Sync title/amount back to the linked activity
    const d = (input.details ?? {}) as Record<string, unknown>
    const linkedActivityId = d.activity_id as string | undefined
    if (linkedActivityId) {
      await supabase
        .from("activities")
        .update({ title: input.title, cost_amount: input.amount })
        .eq("id", linkedActivityId)
      setActivities((prev) =>
        prev.map((a) => (a.id === linkedActivityId ? { ...a, title: input.title, cost_amount: input.amount } : a)),
      )
    }
    setBookings((prev) => prev.map((b) => (b.id === input.id ? ({ ...b, ...input, id: input.id! } as Booking) : b)))
    toast.success("Booking updated")
  }

  async function handleBookingDelete(id: string) {
    const supabase = createClient()
    const deletedBooking = bookings.find((b) => b.id === id)
    const linkedActivityId = (deletedBooking?.details as Record<string, unknown> | null)?.activity_id as
      | string
      | undefined
    await supabase.from("bookings").delete().eq("id", id)
    setBookings((prev) => prev.filter((b) => b.id !== id))
    if (linkedActivityId) {
      await supabase.from("activities").update({ booking_id: null }).eq("id", linkedActivityId)
      setActivities((prev) => prev.map((a) => (a.id === linkedActivityId ? { ...a, booking_id: null } : a)))
    }
    toast.success("Booking removed")
  }

  async function handleCalendarBookingSave(
    input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string },
  ) {
    const supabase = createClient()
    if (input.id) {
      const { error } = await supabase.from("bookings").update({ ...input }).eq("id", input.id)
      if (error) throw error
      setBookings((prev) =>
        prev.map((b) => (b.id === input.id ? ({ ...b, ...input, id: input.id! } as Booking) : b)),
      )
    } else {
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, trip_id: trip.id })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setBookings((prev) => [data as Booking, ...prev])
    }
    setCalendarBookingOpen(false)
    setCalendarTransportOpen(false)
    toast.success("Booking saved")
  }

  async function handleCalendarBookingDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from("bookings").delete().eq("id", id)
    if (error) throw error
    setBookings((prev) => prev.filter((b) => b.id !== id))
    setCalendarBookingOpen(false)
    setCalendarTransportOpen(false)
    toast.success("Booking removed")
  }

  const dragging = activeId ? findActivity(activeId) : null

  return (
    <div className="flex flex-col gap-4">
      <TriplettoAI
        trip={trip}
        activities={activities}
        onActivitiesAdded={(added) => setActivities((prev) => [...prev, ...added])}
      />

      {/* Category filter + view mode toggle — sticky */}
      <div className="sticky top-0 z-20 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-6 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {activeCategories.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveCategories(new Set())}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              All
            </button>
          )}
          {CATEGORY_FILTERS.map((f) => {
            const active = activeCategories.has(f.value)
            return (
              <button
                key={f.value}
                type="button"
                onClick={() =>
                  setActiveCategories((prev) => {
                    const next = new Set(prev)
                    if (next.has(f.value)) next.delete(f.value)
                    else next.add(f.value)
                    return next
                  })
                }
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <div className="flex justify-end">
        <div className="flex gap-0.5 rounded-xl border border-border bg-card p-0.5">
          {(["board", "calendar"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                viewMode === mode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "board" ? (
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Calendar className="h-3.5 w-3.5" aria-hidden />
              )}
              {mode}
            </button>
          ))}
        </div>
        </div>
      </div>

      {viewMode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-6 items-start">
            {/* Day navigation sidebar — 30% */}
            <aside className="sticky top-14 w-[28%] shrink-0 h-[calc(100vh-12rem)] rounded-2xl border border-border bg-card p-3">
              <DaySidebar
                days={days}
                counts={dayCounts}
                selected={selectedDay}
                onSelect={setSelectedDay}
                activeDragId={activeId}
                weatherByDay={weatherByDay}
              />
            </aside>

            {/* Activity columns — 70% */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {hotelByDay.has(selectedDay) && (
                <HotelBanner
                  activity={hotelByDay.get(selectedDay)!.activity}
                  booking={hotelByDay.get(selectedDay)!.booking}
                />
              )}
              {TIME_BLOCKS.map((block) => {
                const key = `${selectedDay}::${block}` as BlockKey
                const items = buckets.get(key) ?? []
                return (
                  <TimeBlockColumn
                    key={key}
                    id={key}
                    block={block}
                    items={items}
                    onAdd={() => setDrawerState({ mode: "create", day_date: selectedDay, time_block: block })}
                  >
                    <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                      {items.map((a) => {
                        const linkedBooking = activityBookingMap.get(a.id)
                        return (
                          <ActivityCard
                            key={a.id}
                            activity={a}
                            conflicts={conflicts.get(a.id)}
                            hasBooking={!!linkedBooking}
                            onClick={() => setDrawerState({ mode: "edit", activity: a })}
                            onBookingClick={linkedBooking ? () => setBookingOpen(linkedBooking) : undefined}
                          />
                        )
                      })}
                    </SortableContext>
                  </TimeBlockColumn>
                )
              })}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl bg-transparent"
                  onClick={() => setDrawerState({ mode: "create", day_date: selectedDay, time_block: "morning" })}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Add activity
                </Button>
              </div>
            </div>
          </div>

          <DragOverlay>{dragging ? <ActivityCard activity={dragging} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div
          className="-mx-6 flex overflow-hidden border-t border-border"
          style={{ height: "80vh", minHeight: 520 }}
        >
          {/* Calendar — left 60%, scrollable */}
          <div className="min-w-0 flex-[6] overflow-y-auto border-r border-border">
            <div className="px-4 py-4">
              <CalendarView
                days={days}
                activities={activities}
                activeCategories={activeCategories}
                onActivityClick={(a) => {
                  setCalendarSelectedId(a.id)
                  setDrawerState({ mode: "edit", activity: a })
                }}
                onAddActivity={(day_date, start_time, time_block) =>
                  setDrawerState({ mode: "create", day_date, time_block, start_time })
                }
                onAddBooking={() => setCalendarBookingOpen(true)}
                onAddTransport={() => setCalendarTransportOpen(true)}
              />
            </div>
          </div>

          {/* Map — right 40%, fills fixed-height container */}
          <div className="min-w-0 flex-[4] shrink-0">
            <TripMap
              activities={activities}
              destination={trip.destination ?? null}
              days={days}
              selectedActivityId={calendarSelectedId}
              className="h-full w-full"
              containerClassName="h-full w-full"
            />
          </div>
        </div>
      )}

      <ActivityDrawer
        state={drawerState}
        days={days}
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setDrawerState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <BookingDrawer
        open={bookingOpen !== null}
        booking={bookingOpen}
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setBookingOpen(null)}
        onSave={handleBookingSave}
        onDelete={handleBookingDelete}
      />

      {/* New booking/transport drawers triggered from the calendar popup */}
      <BookingDrawer
        open={calendarBookingOpen}
        booking={null}
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setCalendarBookingOpen(false)}
        onSave={handleCalendarBookingSave}
        onDelete={handleCalendarBookingDelete}
      />
      <TransportDrawer
        open={calendarTransportOpen}
        booking={null}
        defaultType="transport"
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        onClose={() => setCalendarTransportOpen(false)}
        onSave={handleCalendarBookingSave}
        onDelete={handleCalendarBookingDelete}
      />
    </div>
  )
}
