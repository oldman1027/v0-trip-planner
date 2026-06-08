"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Calendar, Eye, EyeOff, LayoutGrid, Map as MapIcon, MapPin, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DaySidebar } from "./day-sidebar"
import { TimeBlockColumn } from "./time-block-column"
import { ActivityCard } from "./activity-card"
import { ActivityDrawer } from "./activity-drawer"
import { CalendarView } from "./calendar-view"
import { HotelBanner } from "./hotel-banner"
import { BookingDrawer } from "@/components/trip/bookings/booking-drawer"
import { TransportDrawer } from "@/components/trip/bookings/transport-drawer"
import { TripMap, PIN_PALETTE } from "@/components/trip/overview/trip-map"
import { TriplettoAI } from "@/components/trip/TriplettoAI"
import { useRealtimeActivities } from "@/hooks/use-realtime-activities"
import { usePresence } from "@/hooks/use-presence"
import { useUndoDelete } from "@/hooks/use-undo-delete"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { createClient } from "@/lib/supabase/client"
import { moveActivity, reorderActivities, sendActivityToKIV, scheduleKIVActivity } from "@/app/actions/move-activity"
import { KIVTray } from "./kiv-tray"
import { daysBetween, formatDayLabel, getBlockFromTime } from "@/lib/dates"
import { detectConflicts } from "@/lib/time-conflicts"
import { useTripWeather } from "@/hooks/use-trip-weather"
import { wmoToDisplay } from "@/lib/weather-utils"
import type { Activity, Booking, TimeBlock, Trip } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type BlockKey = `${string}::${TimeBlock}`
type ContainerKey = BlockKey | "kiv"
type ViewMode = "board" | "calendar" | "map"

const CATEGORY_FILTERS: { value: Activity["category"]; label: string }[] = [
  { value: "accommodation", label: "Accommodation" },
  { value: "transport",     label: "Transport" },
  { value: "food",          label: "Dining" },
  { value: "attraction",    label: "Activities" },
  { value: "other",         label: "Other" },
]

function categoryToBookingType(cat: Activity["category"]): Booking["type"] {
  if (cat === "food") return "dining"
  if (cat === "accommodation") return "accommodation"
  if (cat === "transport") return "transport"
  if (cat === "attraction" || cat === "entertainment" || cat === "shopping") return "activities"
  return "other"
}

/** Build the booking fields to pre-fill when auto-creating or syncing a linked booking. */
function buildLinkedBookingFields(
  type: Booking["type"],
  input: { title: string; day_date: string; start_time: string | null; location: string | null },
  activityId: string,
  existingDetails?: Record<string, unknown>,
): { topLevel: Record<string, unknown>; details: Record<string, unknown> } {
  const base = existingDetails ? { ...existingDetails } : {}
  if (type === "dining") {
    const datetime = input.day_date && input.start_time ? `${input.day_date}T${input.start_time}` : null
    return {
      topLevel: { booking_date: input.day_date || null },
      details: { ...base, activity_id: activityId, restaurant_name: input.title, datetime, location: input.location || null },
    }
  }
  if (type === "accommodation") {
    return {
      topLevel: { booking_date: input.day_date || null, check_in_time: input.start_time || null },
      details: { ...base, activity_id: activityId, address: input.location || null },
    }
  }
  if (type === "transport") {
    return {
      topLevel: { booking_date: input.day_date || null, departure_time: input.start_time || null },
      details: { ...base, activity_id: activityId, transport_type: "transport", from_city: input.location || null },
    }
  }
  // activities / other
  return {
    topLevel: { booking_date: input.day_date || null, departure_time: input.start_time || null },
    details: { ...base, activity_id: activityId, location: input.location || null },
  }
}

const TIME_BLOCKS: TimeBlock[] = ["morning", "afternoon", "night"]

const BLOCK_START_TIMES: Record<TimeBlock, string> = {
  morning: "08:00",
  afternoon: "13:00",
  night: "19:00",
}

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
  const activitiesRef = useRef(activities)
  activitiesRef.current = activities
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [selectedDay, setSelectedDay] = useState<string>(days[0])
  const [activeId, setActiveId] = useState<string | null>(null)
  const dragStartedFromKIV = useRef(false)
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
  const [showMap, setShowMap] = useState(true)
  const [mobileTab, setMobileTab] = useState<"calendar" | "map">("calendar")
  const [mapFilterDay, setMapFilterDay] = useState<string | null>(null)
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null)
  const [focusedActivityId, setFocusedActivityId] = useState<string | null>(null)

  // Shopping and Entertainment are hidden from filter tabs but grouped under Other
  const effectiveCategories = useMemo(() => {
    if (!activeCategories.has("other")) return activeCategories
    const expanded = new Set(activeCategories)
    expanded.add("shopping")
    expanded.add("entertainment")
    return expanded
  }, [activeCategories])

  const conflicts = useMemo(() => detectConflicts(activities), [activities])

  const { softDelete: softDeleteActivity } = useUndoDelete<Activity>()
  const { softDelete: softDeleteBooking } = useUndoDelete<Booking>()

  // Real-time: sync activity changes from other collaborators
  // Callbacks use functional state updates so no deps needed — the hook reads
  // them via refs and won't re-subscribe when the board re-renders.
  useRealtimeActivities({
    tripId: trip.id,
    onInsert: (activity) => {
      console.log("[board] onInsert called:", activity.id)
      setActivities((prev) => {
        const isDupe = prev.some((a) => a.id === activity.id)
        console.log("[board] onInsert setActivities — isDupe:", isDupe, "prevCount:", prev.length)
        return isDupe ? prev : [...prev, activity]
      })
    },
    onUpdate: (activity) => {
      console.log("[board] onUpdate called:", activity.id)
      setActivities((prev) => {
        const exists = prev.some((a) => a.id === activity.id)
        console.log("[board] onUpdate setActivities — exists:", exists, "prevCount:", prev.length)
        return prev.map((a) => a.id === activity.id ? activity : a)
      })
    },
    onDelete: (activityId) => {
      console.log("[board] onDelete called:", activityId)
      setActivities((prev) => {
        console.log("[board] onDelete setActivities — prevCount:", prev.length)
        return prev.filter((a) => a.id !== activityId)
      })
    },
  })

  const { onlineUsers } = usePresence(trip.id)

  // Weather data for sidebar chips and calendar headers
  const { weatherByDate, loading: weatherLoading } = useTripWeather(trip)

  const weatherByDay = useMemo(() => {
    const map = new Map<string, { icon: string; high: number; rainChance: number }>()
    for (const [date, w] of Object.entries(weatherByDate)) {
      map.set(date, { icon: wmoToDisplay(w.code).icon, high: w.max, rainChance: w.rainChance })
    }
    return map
  }, [weatherByDate])

  // One-time: fix activities whose time_block doesn't match their start_time
  useEffect(() => {
    const mismatches = initialActivities.filter(
      (a) => a.start_time && a.time_block && getBlockFromTime(a.start_time) !== a.time_block,
    )
    if (mismatches.length === 0) return
    const supabase = createClient()
    Promise.all(
      mismatches.map((a) =>
        supabase.from("activities").update({ time_block: getBlockFromTime(a.start_time!) }).eq("id", a.id),
      ),
    ).catch(() => null)
    setActivities((prev) =>
      prev.map((a) => {
        if (!a.start_time || !a.time_block) return a
        const correct = getBlockFromTime(a.start_time)
        return correct !== a.time_block ? { ...a, time_block: correct } : a
      }),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs only once on mount

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
        if (effectiveCategories.size > 0 && !effectiveCategories.has(a.category)) continue
        const key = `${a.day_date}::${a.time_block}` as BlockKey
        const list = out.get(key)
        if (list) list.push(a)
      }
    }
    for (const list of out.values()) list.sort((a, b) => a.position - b.position)
    return out
  }, [activities, days, effectiveCategories])

  const kivActivities = useMemo(
    () => activities.filter((a) => a.is_kiv),
    [activities],
  )

  const dayCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const day of days) c.set(day, 0)
    for (const a of activities) {
      if (a.day_date && !a.is_wishlist && !a.is_kiv) c.set(a.day_date, (c.get(a.day_date) ?? 0) + 1)
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

  const anyDrawerOpen =
    drawerState !== null ||
    bookingOpen !== null ||
    calendarBookingOpen ||
    calendarTransportOpen

  // Page-level shortcuts: fire only when no drawer/dialog is open
  useKeyboardShortcuts(
    [
      {
        key: "n",
        handler: () =>
          setDrawerState({ mode: "create", day_date: selectedDay, time_block: "morning" }),
      },
      { key: "1", handler: () => setViewMode("board") },
      { key: "2", handler: () => setViewMode("calendar") },
      {
        key: "m",
        handler: () => {
          if (viewMode === "calendar") setShowMap((v) => !v)
        },
      },
      {
        key: "ArrowRight",
        handler: () => {
          const idx = days.indexOf(selectedDay)
          if (idx < days.length - 1) setSelectedDay(days[idx + 1])
        },
      },
      {
        key: "ArrowDown",
        handler: () => {
          const idx = days.indexOf(selectedDay)
          if (idx < days.length - 1) setSelectedDay(days[idx + 1])
        },
      },
      {
        key: "ArrowLeft",
        handler: () => {
          const idx = days.indexOf(selectedDay)
          if (idx > 0) setSelectedDay(days[idx - 1])
        },
      },
      {
        key: "ArrowUp",
        handler: () => {
          const idx = days.indexOf(selectedDay)
          if (idx > 0) setSelectedDay(days[idx - 1])
        },
      },
    ],
    !anyDrawerOpen,
  )

  // Delete shortcut: fires only when no drawer open and an activity is focused
  useKeyboardShortcuts(
    [
      { key: "Delete", handler: () => focusedActivityId && handleDelete(focusedActivityId) },
      { key: "Backspace", handler: () => focusedActivityId && handleDelete(focusedActivityId) },
    ],
    !anyDrawerOpen && focusedActivityId !== null,
  )

  function findActivity(id: string) {
    return activities.find((a) => a.id === id) ?? null
  }

  function findContainer(id: string): ContainerKey | null {
    if (!id) return null
    if (id === "kiv") return "kiv"
    if (id.includes("::")) return id as BlockKey
    if (id.startsWith("day::")) return null
    const a = findActivity(id)
    if (!a) return null
    if (a.is_kiv) return "kiv"
    if (!a.day_date || !a.time_block) return null
    return `${a.day_date}::${a.time_block}` as BlockKey
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setActiveId(id)
    dragStartedFromKIV.current = findActivity(id)?.is_kiv ?? false
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return
    if (overIdStr.startsWith("day::")) return

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return
    if (activeContainer === overContainer) return

    // Dragging into KIV tray
    if (overContainer === "kiv") {
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activeIdStr ? { ...a, is_kiv: true, day_date: null, time_block: null, start_time: null } : a,
        ),
      )
      return
    }

    // Dragging out of KIV tray onto a time block
    if (activeContainer === "kiv") {
      const [day, block] = overContainer.split("::") as [string, TimeBlock]
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activeIdStr
            ? { ...a, is_kiv: false, day_date: day, time_block: block, start_time: BLOCK_START_TIMES[block] }
            : a,
        ),
      )
      return
    }

    // Cross-container move within board
    const [day, block] = overContainer.split("::") as [string, TimeBlock]
    setActivities((prev) =>
      prev.map((a) => (a.id === activeIdStr ? { ...a, day_date: day, time_block: block, start_time: BLOCK_START_TIMES[block] } : a)),
    )
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    const wasKIV = dragStartedFromKIV.current
    dragStartedFromKIV.current = false
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const moved = findActivity(activeIdStr)
    if (!moved) return

    // Drop on a day card → drop into morning block of that day
    if (overIdStr.startsWith("day::")) {
      const day = overIdStr.replace("day::", "")
      if (wasKIV) {
        setSelectedDay(day)
        await applyMoveFromKIV(activeIdStr, day, "morning", 0)
      } else if (day !== moved.day_date || moved.time_block !== "morning") {
        setSelectedDay(day)
        await applyMove(activeIdStr, day, "morning", 0)
      }
      return
    }

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return

    // Drop onto or within KIV tray
    if (overContainer === "kiv") {
      if (!wasKIV) await applyMoveToKIV(activeIdStr)
      return
    }

    // Drop from KIV tray onto a board time block
    if (wasKIV) {
      const [overDay, overBlock] = overContainer.split("::") as [string, TimeBlock]
      const list = activities
        .filter((a) => a.day_date === overDay && a.time_block === overBlock && !a.is_kiv)
        .sort((a, b) => a.position - b.position)
      const overIndex = list.findIndex((a) => a.id === overIdStr)
      await applyMoveFromKIV(activeIdStr, overDay, overBlock, Math.max(0, overIndex))
      return
    }

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
    const startTime = BLOCK_START_TIMES[block]
    // Reorder optimistically: build new bucket order
    setActivities((prev) => {
      const updated = prev.map((a) => (a.id === activityId ? { ...a, day_date: day, time_block: block, start_time: startTime } : a))
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

    console.log('[board] drag save:', activityId, day, block)

    // Persist using server action
    try {
      // Update the moved activity itself
      await moveActivity(activityId, day, block, targetIndex, startTime)

      // Renumber the bucket positions for stability — read via ref so we don't
      // trigger a re-render and don't put async work inside a setState updater.
      const bucket = activitiesRef.current
        .filter((a) => a.day_date === day && a.time_block === block)
        .sort((a, b) => a.position - b.position)
      reorderActivities(bucket.map((a, idx) => ({ id: a.id, position: idx }))).catch(() => null)
    } catch (err) {
      toast.error("Could not save order", { description: err instanceof Error ? err.message : "Unknown" })
    }
  }

  async function applyMoveToKIV(activityId: string) {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId ? { ...a, is_kiv: true, day_date: null, time_block: null, start_time: null } : a,
      ),
    )
    try {
      await sendActivityToKIV(activityId)
    } catch (err) {
      toast.error("Could not save", { description: err instanceof Error ? err.message : "Unknown" })
    }
  }

  async function applyMoveFromKIV(activityId: string, day: string, block: TimeBlock, targetIndex: number) {
    const startTime = BLOCK_START_TIMES[block]
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId
          ? { ...a, is_kiv: false, day_date: day, time_block: block, start_time: startTime }
          : a,
      ),
    )
    try {
      await scheduleKIVActivity(activityId, day, block, targetIndex, startTime)
    } catch (err) {
      toast.error("Could not save", { description: err instanceof Error ? err.message : "Unknown" })
    }
  }

  async function handleKIVAdd(title: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("activities")
      .insert({
        trip_id: trip.id,
        day_date: null,
        time_block: null,
        position: kivActivities.length,
        title,
        category: "other",
        is_kiv: true,
        is_wishlist: false,
      })
      .select()
      .single()
    if (error || !data) { toast.error("Could not add idea"); return }
    setActivities((prev) => [...prev, data as Activity])
  }

  async function handleKIVAssignDay(activityId: string, day: string) {
    const block: TimeBlock = "morning"
    setSelectedDay(day)
    await applyMoveFromKIV(activityId, day, block, 0)
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
    if (trip.start_date && trip.end_date && input.day_date &&
        (input.day_date < trip.start_date || input.day_date > trip.end_date)) {
      throw new Error("Invalid activity date: outside trip range")
    }
    // Enforce correct block based on start_time (user may have manually overridden in the drawer,
    // but the drawer's handleStartChange already keeps them in sync — this is a safety net)
    const resolvedBlock = input.start_time ? getBlockFromTime(input.start_time) : input.time_block
    const resolvedInput = { ...input, time_block: resolvedBlock }
    const supabase = createClient()
    if (resolvedInput.id) {
      // Edit existing activity
      const { error } = await supabase
        .from("activities")
        .update({
          day_date: resolvedInput.day_date,
          time_block: resolvedInput.time_block,
          title: resolvedInput.title,
          location: resolvedInput.location,
          start_time: resolvedInput.start_time,
          end_time: resolvedInput.end_time,
          notes: resolvedInput.notes,
          cost_amount: resolvedInput.cost_amount,
          photo_url: resolvedInput.photo_url,
          category: resolvedInput.category,
        })
        .eq("id", resolvedInput.id)
      if (error) throw error

      // Sync linked booking if it exists
      const existingBooking = activityBookingMap.get(resolvedInput.id!)
      let resolvedBookingId: string | null = existingBooking?.id ?? null
      if (resolvedInput.needs_booking) {
        if (existingBooking) {
          if (existingBooking.type === "dining") {
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
              .update({ title: input.title, details: newDetails, booking_date: input.day_date || null })
              .eq("id", existingBooking.id)
            setBookings((prev) =>
              prev.map((b) =>
                b.id === existingBooking.id ? { ...b, title: input.title, details: newDetails } : b,
              ),
            )
          } else {
            // Sync name, date, time, location back to the linked booking (not amount/status/notes)
            const _syncType = categoryToBookingType(input.category)
            const _syncExistingDetails = (existingBooking.details ?? {}) as Record<string, unknown>
            const _syncFields = buildLinkedBookingFields(_syncType, input, _syncExistingDetails.activity_id as string, _syncExistingDetails)
            await supabase
              .from("bookings")
              .update({
                title: input.title,
                type: _syncType,
                details: _syncFields.details,
                ..._syncFields.topLevel,
              })
              .eq("id", existingBooking.id)
            setBookings((prev) =>
              prev.map((b) =>
                b.id === existingBooking.id
                  ? { ...b, title: input.title, type: _syncType, details: _syncFields.details, ..._syncFields.topLevel }
                  : b,
              ),
            )
          }
        } else {
          // Create new linked booking
          const _newLinkType = categoryToBookingType(input.category)
          const _newLinkFields = buildLinkedBookingFields(_newLinkType, input, input.id!)
          const { data: newBooking } = await supabase
            .from("bookings")
            .insert({
              trip_id: trip.id,
              type: _newLinkType,
              title: input.title,
              amount: input.cost_amount,
              currency: trip.default_currency ?? "USD",
              payment_status: "pending",
              reservation_status: "tbc",
              details: _newLinkFields.details,
              ..._newLinkFields.topLevel,
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
        prev.map((a) => (a.id === resolvedInput.id ? { ...a, ...resolvedInput, booking_id: resolvedBookingId } : a)),
      )
      toast.success("Activity updated")
    } else {
      // Create new activity
      const targetIndex = (buckets.get(`${resolvedInput.day_date}::${resolvedInput.time_block}` as BlockKey) ?? []).length
      const { data, error } = await supabase
        .from("activities")
        .insert({
          trip_id: trip.id,
          day_date: resolvedInput.day_date,
          time_block: resolvedInput.time_block,
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
        const _createType = categoryToBookingType(input.category)
        const _createFields = buildLinkedBookingFields(_createType, input, newActivity.id)
        const { data: newBooking } = await supabase
          .from("bookings")
          .insert({
            trip_id: trip.id,
            type: _createType,
            title: input.title,
            amount: input.cost_amount,
            currency: trip.default_currency ?? "USD",
            payment_status: "pending",
            details: _createFields.details,
            ..._createFields.topLevel,
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
    const activity = activities.find((a) => a.id === id)
    if (!activity) return
    const linkedBooking = activityBookingMap.get(id)
    setActivities((p) => p.filter((a) => a.id !== id))
    if (linkedBooking) setBookings((prev) => prev.filter((b) => b.id !== linkedBooking.id))
    softDeleteActivity(activity, {
      label: "Activity",
      onConfirm: async (act) => {
        const supabase = createClient()
        const { error } = await supabase.from("activities").delete().eq("id", act.id)
        if (error) throw error
        if (linkedBooking) {
          await supabase.from("bookings").delete().eq("id", linkedBooking.id)
        }
      },
      onRestore: (act) => {
        setActivities((prev) => [...prev, act])
        if (linkedBooking) setBookings((prev) => [...prev, linkedBooking])
      },
    })
  }

  async function handleBookingSave(input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }): Promise<string | undefined> {
    const supabase = createClient()
    if (!input.id) return undefined
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
    const deletedBooking = bookings.find((b) => b.id === id)
    if (!deletedBooking) return
    const linkedActivityId = (deletedBooking.details as Record<string, unknown> | null)?.activity_id as
      | string
      | undefined
    setBookings((prev) => prev.filter((b) => b.id !== id))
    if (linkedActivityId) {
      setActivities((prev) => prev.map((a) => (a.id === linkedActivityId ? { ...a, booking_id: null } : a)))
    }
    softDeleteBooking(deletedBooking, {
      label: "Booking",
      onConfirm: async (b) => {
        const supabase = createClient()
        await supabase.from("bookings").delete().eq("id", b.id)
        if (linkedActivityId) {
          await supabase.from("activities").update({ booking_id: null }).eq("id", linkedActivityId)
        }
      },
      onRestore: (b) => {
        setBookings((prev) => [...prev, b])
        if (linkedActivityId) {
          setActivities((prev) =>
            prev.map((a) => (a.id === linkedActivityId ? { ...a, booking_id: b.id } : a)),
          )
        }
      },
    })
  }

  async function handleCalendarBookingSave(
    input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string },
  ): Promise<string | undefined> {
    const supabase = createClient()
    if (input.id) {
      const { error } = await supabase.from("bookings").update({ ...input }).eq("id", input.id)
      if (error) throw error
      setBookings((prev) =>
        prev.map((b) => (b.id === input.id ? ({ ...b, ...input, id: input.id! } as Booking) : b)),
      )
      setCalendarBookingOpen(false)
      setCalendarTransportOpen(false)
      toast.success("Booking saved")
      return undefined
    } else {
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, trip_id: trip.id })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setBookings((prev) => [data as Booking, ...prev])
      setCalendarBookingOpen(false)
      setCalendarTransportOpen(false)
      toast.success("Booking saved")
      return (data as Booking).id
    }
  }

  async function handleCalendarBookingDelete(id: string) {
    const deletedBooking = bookings.find((b) => b.id === id)
    if (!deletedBooking) return
    setBookings((prev) => prev.filter((b) => b.id !== id))
    setCalendarBookingOpen(false)
    setCalendarTransportOpen(false)
    softDeleteBooking(deletedBooking, {
      label: "Booking",
      onConfirm: async (b) => {
        const supabase = createClient()
        const { error } = await supabase.from("bookings").delete().eq("id", b.id)
        if (error) throw error
      },
      onRestore: (b) => {
        setBookings((prev) => [...prev, b])
      },
    })
  }

  const dragging = activeId ? findActivity(activeId) : null

  const handleActivitiesAdded = useCallback((added: Activity[]) => {
    setActivities((prev) => [...prev, ...added])
  }, [])

  const handleCalendarActivityUpdated = useCallback((activity: Activity) => {
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? activity : a)))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <TriplettoAI
        trip={trip}
        activities={activities}
        onActivitiesAdded={handleActivitiesAdded}
      />

      {/* Category filter + view mode toggle — sticky below navbar only */}
      <div className="sticky top-[65px] z-40 -mx-4 sm:-mx-6 lg:-mx-8 shadow-sm bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* "All" is always visible; active when nothing is filtered */}
              <button
                type="button"
                onClick={() => setActiveCategories(new Set())}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeCategories.size === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
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
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              {/* Presence: who else is viewing this trip */}
              {onlineUsers.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {onlineUsers.slice(0, 4).map((user) => (
                      <Avatar
                        key={user.userId}
                        className="h-6 w-6 border-2 border-background shrink-0"
                        title={`${user.name} is viewing`}
                      >
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                        ) : null}
                        <AvatarFallback
                          className="text-[9px] font-bold text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.name[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A9D6C5] animate-pulse" />
                    <span className="text-[10px] text-[#6D8F87] font-medium">
                      {onlineUsers.length === 1 ? "1 online" : `${onlineUsers.length} online`}
                    </span>
                  </div>
                </div>
              )}
              {viewMode === "calendar" && (
                <button
                  type="button"
                  onClick={() => setShowMap((v) => !v)}
                  className="hidden md:flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  {showMap ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {showMap ? "Hide map" : "Show map"}
                </button>
              )}
              <div className="flex gap-0.5 rounded-xl border border-border bg-card p-0.5">
                {(["board", "calendar", "map"] as ViewMode[]).map((mode) => (
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
                    ) : mode === "calendar" ? (
                      <Calendar className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <MapIcon className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {mode}
                  </button>
                ))}
              </div>
            </div>
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
            <aside className="sticky top-[114px] w-[28%] shrink-0 h-[calc(100vh-114px)] rounded-2xl border border-border bg-card p-3">
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
                        const bookingStatus = !a.booking_id
                          ? "not-required" as const
                          : linkedBooking?.confirmation_number
                            || linkedBooking?.reservation_status === "confirmed"
                            || (!linkedBooking?.reservation_status && linkedBooking?.payment_status === "confirmed")
                            ? "booked" as const
                            : "pending" as const
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              "rounded-xl transition-[box-shadow]",
                              focusedActivityId === a.id && drawerState === null && "ring-2 ring-primary/30",
                            )}
                          >
                            <ActivityCard
                              activity={a}
                              conflicts={conflicts.get(a.id)}
                              bookingStatus={bookingStatus}
                              onClick={() => {
                                setFocusedActivityId(a.id)
                                setDrawerState({ mode: "edit", activity: a })
                              }}
                              onBookingClick={linkedBooking ? () => setBookingOpen(linkedBooking) : undefined}
                            />
                          </div>
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

          <KIVTray
            tripId={trip.id}
            activities={kivActivities}
            days={days}
            onAssignDay={handleKIVAssignDay}
            onDelete={handleDelete}
            onAdd={handleKIVAdd}
          />

          <DragOverlay>{dragging ? <ActivityCard activity={dragging} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : viewMode === "calendar" ? (
        <div className="flex flex-col gap-4">
          {/* Mobile tab switcher — hidden on md+ */}
          <div className="flex border-b border-border md:hidden">
            <button
              type="button"
              onClick={() => setMobileTab("calendar")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                mobileTab === "calendar"
                  ? "border-[#6D8F87] text-[#6D8F87]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("map")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                mobileTab === "map"
                  ? "border-[#6D8F87] text-[#6D8F87]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Map
            </button>
          </div>

          {/* Calendar + Map: responsive grid on desktop */}
          <div
            className={cn(
              showMap ? "md:grid md:grid-cols-[1fr_420px] md:items-start md:gap-4" : "",
            )}
          >
            {/* Calendar */}
            <div
              className={cn(
                "overflow-x-auto",
                mobileTab === "map" && "hidden md:block",
              )}
            >
              <CalendarView
                days={days}
                activities={activities}
                activeCategories={effectiveCategories}
                onActivityClick={(a) => {
                  setFocusedActivityId(a.id)
                  setCalendarSelectedId(a.id)
                  setDrawerState({ mode: "edit", activity: a })
                }}
                onAddActivity={(day_date, start_time, time_block) =>
                  setDrawerState({ mode: "create", day_date, time_block, start_time })
                }
                onAddBooking={() => setCalendarBookingOpen(true)}
                onAddTransport={() => setCalendarTransportOpen(true)}
                accommodationBookings={bookings.filter(
                  (b) => b.type === "accommodation" && !!b.booking_date && !!b.check_out_date,
                )}
                onViewBooking={(id) => {
                  const b = bookings.find((b) => b.id === id)
                  if (b) setBookingOpen(b)
                }}
                onActivityUpdated={handleCalendarActivityUpdated}
                weatherByDate={weatherByDate}
                weatherLoading={weatherLoading}
              />
            </div>

            {/* Map — mobile: full-height when map tab active; desktop: sticky panel */}
            <div
              className={cn(
                "hidden",
                mobileTab === "map" &&
                  "block h-[60vh] rounded-xl overflow-hidden border border-border",
                showMap
                  ? "md:block md:self-start md:sticky md:top-[114px] md:h-[calc(100vh-114px)] md:rounded-xl md:overflow-hidden md:border md:border-border"
                  : "md:hidden",
              )}
            >
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
        </div>
      ) : (
        /* ── Map tab — full-screen two-column layout ─────────────────────── */
        <div className="flex h-[calc(100vh-114px)] overflow-hidden rounded-2xl border border-border">
          {/* Map panel */}
          <div className="relative flex-1 min-w-0">
            <TripMap
              activities={activities}
              destination={trip.destination ?? null}
              days={days}
              selectedActivityId={mapSelectedId}
              className="h-full w-full"
              containerClassName="h-full w-full"
              onPinClick={(a) => {
                setMapSelectedId(a.id)
                setFocusedActivityId(a.id)
                setDrawerState({ mode: "edit", activity: a })
              }}
            />
          </div>

          {/* Activity sidebar */}
          <div className="flex w-72 shrink-0 flex-col border-l border-border bg-background overflow-hidden">
            {/* Day filter */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2">
              <button
                type="button"
                onClick={() => setMapFilterDay(null)}
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  !mapFilterDay
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {days.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setMapFilterDay((d) => (d === day ? null : day))}
                  className={cn(
                    "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    mapFilterDay === day
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  D{i + 1}
                </button>
              ))}
            </div>

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto">
              {days
                .filter((day) => !mapFilterDay || mapFilterDay === day)
                .map((day, idx) => {
                  const dayActivities = activities
                    .filter((a) => a.day_date === day && !a.is_wishlist && !a.is_kiv && a.location)
                    .sort((a, b) => (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99"))
                  if (dayActivities.length === 0) return null
                  const dayNum = days.indexOf(day) + 1
                  return (
                    <div key={day}>
                      <div className="sticky top-0 border-b border-border bg-muted/40 px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Day {dayNum} · {formatDayLabel(day)}
                        </span>
                      </div>
                      {dayActivities.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setMapSelectedId(a.id)
                            setFocusedActivityId(a.id)
                            setDrawerState({ mode: "edit", activity: a })
                          }}
                          className={cn(
                            "flex w-full items-start gap-2.5 border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                            mapSelectedId === a.id && "bg-primary/5",
                          )}
                        >
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: PIN_PALETTE[(dayNum - 1) % PIN_PALETTE.length].bg }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight">{a.title}</p>
                            {(a.start_time || a.location) && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {a.start_time ? a.start_time.slice(0, 5) : ""}
                                {a.start_time && a.location ? " · " : ""}
                                {a.location ?? ""}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {activities.filter((a) => a.location && !a.is_wishlist && !a.is_kiv).length} locations plotted
              </span>
            </div>
          </div>
        </div>
      )}

      <ActivityDrawer
        state={drawerState}
        days={days}
        currency={trip.default_currency ?? "USD"}
        tripStart={trip.start_date}
        tripEnd={trip.end_date}
        linkedBooking={drawerState?.mode === "edit" ? (activityBookingMap.get(drawerState.activity.id) ?? null) : null}
        onClose={() => setDrawerState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <BookingDrawer
        open={bookingOpen !== null}
        booking={bookingOpen}
        tripId={trip.id}
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
        tripId={trip.id}
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
        tripId={trip.id}
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
