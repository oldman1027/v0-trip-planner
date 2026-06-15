"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { BedDouble, CalendarPlus, Ticket, Bus } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseDateOnly } from "@/lib/dates"
import { createClient } from "@/lib/supabase/client"
import type { Activity, Booking, KIVNote, TimeBlock } from "@/lib/types"
import { toast } from "sonner"
import { GapIndicator } from "./gap-indicator"
import { wmoToDisplay, wmoColor } from "@/lib/weather-utils"
import type { DailyWeather } from "@/app/api/weather/route"


// ── Category accent colors (spec) ──────────────────────────────────────────
const CATEGORY_STYLE: Record<
  Activity["category"],
  { bg: string; border: string; text: string; badge: string }
> = {
  dining:        { bg: "#FFF1E4", border: "#F7C89A", text: "#A85B1A", badge: "#A85B1A" },
  experiences:   { bg: "#FFF8D6", border: "#F0D36B", text: "#8D7200", badge: "#8D7200" },
  transport:     { bg: "#E8F0FF", border: "#A8C4FF", text: "#3D63A5", badge: "#3D63A5" },
  accommodation: { bg: "#F3ECFF", border: "#D6C6F7", text: "#6A55A3", badge: "#6A55A3" },
  other:         { bg: "#E6F4F2", border: "#B7E2DE", text: "#157F7A", badge: "#157F7A" },
}

// ── Accommodation band colors — all purple pill per spec ───────────────────
const HOTEL_COLORS = [
  { bg: "#F5F3FF", border: "#C4B5FD", text: "#2C4A45" },
  { bg: "#F5F3FF", border: "#C4B5FD", text: "#2C4A45" },
  { bg: "#F5F3FF", border: "#C4B5FD", text: "#2C4A45" },
  { bg: "#F5F3FF", border: "#C4B5FD", text: "#2C4A45" },
] as const

interface AccommodationBand {
  id: string
  name: string
  nights: number
  startColIndex: number
  spanCount: number
  colorIndex: number
  dateRange: string
}

function getAccommodationBands(bookings: Booking[], days: string[]): AccommodationBand[] {
  if (!days.length) return []
  const firstDay = days[0]!
  const lastDay = days[days.length - 1]!
  return bookings
    .filter((b) => b.booking_date && b.check_out_date && b.booking_date <= lastDay && b.check_out_date > firstDay)
    .map((b, idx) => {
      const checkIn = b.booking_date!
      const checkOut = b.check_out_date!
      const startColIndex = Math.max(0, days.findIndex((d) => d >= checkIn))
      const endIdx = days.findIndex((d) => d >= checkOut)
      const endColIndex = endIdx < 0 ? days.length : endIdx
      const spanCount = Math.max(1, endColIndex - startColIndex)
      const nights = Math.round(
        (new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) / 86_400_000,
      )
      const inDate  = parseDateOnly(checkIn)
      const outDate = parseDateOnly(checkOut)
      const dateRange =
        inDate.getMonth() === outDate.getMonth()
          ? `${format(inDate, "MMM d")}–${format(outDate, "d")}`
          : `${format(inDate, "MMM d")}–${format(outDate, "MMM d")}`
      return { id: b.id, name: b.title, nights, startColIndex, spanCount, colorIndex: idx % HOTEL_COLORS.length, dateRange }
    })
}

/** Assign non-overlapping rows to bands using a sweep-line algorithm. */
function assignBandRows(bands: AccommodationBand[]): (AccommodationBand & { row: number })[] {
  const sorted = [...bands].sort((a, b) => a.startColIndex - b.startColIndex)
  const rowEnds: number[] = []
  return sorted.map((band) => {
    const end = band.startColIndex + band.spanCount
    let row = rowEnds.findIndex((endCol) => endCol <= band.startColIndex)
    if (row === -1) row = rowEnds.length
    rowEnds[row] = end
    return { ...band, row }
  })
}

// ── Band layout constants ──────────────────────────────────────────────────
const MAX_BAND_ROWS = 3
const BAND_ROW_H = 28   // px height of each band row
const BAND_GAP   = 2    // px gap between rows

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_START = 6
const HOUR_END = 23
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const SLOT_H = 38        // px per hour  →  18 × 38 = 684 px total
const SNAP_MINS = 15
const TIME_COL_W = 52
const DAY_COL_MIN_W = 140  // fixed column width — columns scroll horizontally rather than shrinking
const BLOCK_HOUR: Record<string, number> = { morning: 7, afternoon: 12, night: 19 }
// Minimum px height a rendered card actually occupies (title + time label + padding ≈ 40px).
// Used to anchor gap indicators below the card's real visual bottom, not its time-based bottom.
const MIN_CARD_RENDER_H = 40

// ── Types ──────────────────────────────────────────────────────────────────
type DragState = {
  type: "move" | "resize"
  activityId: string
  origActivity: Activity
  startX: number
  startY: number
  origTop: number
  origHeight: number
  origDayIdx: number
  currentTop: number
  currentHeight: number
  currentDayIdx: number
}
type Laid = { activity: Activity; col: number; totalCols: number }
type ClickMenu = {
  clientX: number
  clientY: number
  top: number
  day_date: string
  start_time: string
  time_block: TimeBlock
}

// ── Pure helpers ───────────────────────────────────────────────────────────
function timeToMins(t: string | null | undefined): number {
  if (!t) return HOUR_START * 60
  const p = t.split(":").map(Number)
  return p[0] * 60 + (p[1] ?? 0)
}
function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}
function topToMins(top: number): number {
  return HOUR_START * 60 + Math.round((top / SLOT_H) * 60)
}
function minsToTop(mins: number): number {
  return ((mins - HOUR_START * 60) / 60) * SLOT_H
}
function snap(px: number): number {
  const step = (SLOT_H / 60) * SNAP_MINS
  return Math.round(px / step) * step
}
function actDurationMins(a: Activity): number {
  if (a.start_time && a.end_time) {
    const d = timeToMins(a.end_time) - timeToMins(a.start_time)
    return d > 0 ? d : 60
  }
  return 60
}
function calcPos(a: Activity): { top: number; height: number } {
  const startMins = a.start_time
    ? timeToMins(a.start_time)
    : (BLOCK_HOUR[a.time_block ?? "morning"] ?? 7) * 60
  const clamped = Math.max(HOUR_START * 60, Math.min(startMins, HOUR_END * 60))
  return { top: minsToTop(clamped), height: (actDurationMins(a) / 60) * SLOT_H }
}
// Match calcPos: use time_block default when start_time is absent
function effectiveStartMins(a: Activity): number {
  if (a.start_time) return timeToMins(a.start_time)
  return (BLOCK_HOUR[a.time_block ?? "morning"] ?? 7) * 60
}

function layoutActivities(acts: Activity[]): Laid[] {
  if (!acts.length) return []
  const sorted = [...acts].sort((a, b) => effectiveStartMins(a) - effectiveStartMins(b))
  const intervals = sorted.map((a) => ({
    start: effectiveStartMins(a),
    end: effectiveStartMins(a) + actDurationMins(a),
  }))
  const colEnds: number[] = []
  const colFor: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    let col = colEnds.findIndex((end) => end <= intervals[i].start)
    if (col === -1) col = colEnds.length
    colEnds[col] = intervals[i].end
    colFor[i] = col
  }
  // Per-activity totalCols: only count columns among activities that actually overlap this one.
  // Non-overlapping activities always get full width (totalCols = 1).
  return sorted.map((a, i) => {
    let maxCol = colFor[i]
    for (let j = 0; j < sorted.length; j++) {
      if (i !== j && intervals[i].start < intervals[j].end && intervals[i].end > intervals[j].start) {
        maxCol = Math.max(maxCol, colFor[j])
      }
    }
    return { activity: a, col: colFor[i], totalCols: maxCol + 1 }
  })
}
function fmtHour(h: number): string {
  if (h === 12) return "12p"
  return h < 12 ? `${h}a` : `${h - 12}p`
}
function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── KIV Calendar Column ────────────────────────────────────────────────────

function KIVCalendarColumn({
  tripId,
  kivActivities,
  days,
  onAssignDay,
}: {
  tripId: string
  kivActivities: Activity[]
  days: string[]
  onAssignDay?: (activityId: string, day: string) => void
}) {
  const [notes, setNotes] = useState<KIVNote[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!tripId) return
    const supabase = createClient()
    supabase
      .from("kiv_notes")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setNotes((data ?? []) as KIVNote[]))
  }, [tripId])

  const total = kivActivities.length + notes.length

  return (
    <div className="flex flex-col w-[140px] shrink-0 border-l-2 border-dashed border-muted-foreground/20 bg-card">
      {/* Header */}
      <div className="flex min-h-[44px] items-center justify-between border-b border-border px-2 py-2 sticky top-0 bg-card z-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">KIV</p>
          <p className="text-[9px] text-muted-foreground/60">Keep in view</p>
        </div>
        {total > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {total}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
        {kivActivities.map((a) => (
          <div key={a.id} className="group rounded-lg border border-dashed border-border bg-background p-1.5">
            <p className="text-[11px] font-medium leading-tight text-foreground line-clamp-2">{a.title}</p>
            {a.location && (
              <p className="text-[9px] text-muted-foreground truncate mt-0.5">{a.location.split(",")[0]}</p>
            )}
            {onAssignDay && (
              expandedId === a.id ? (
                <div className="mt-1 space-y-0.5">
                  {days.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      className="w-full rounded px-1 py-0.5 text-left text-[9px] text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => { onAssignDay(a.id, day); setExpandedId(null) }}
                    >
                      D{i + 1} · {day.slice(5)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted transition-colors"
                    onClick={() => setExpandedId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-1 w-full rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setExpandedId(a.id)}
                >
                  Assign to day
                </button>
              )
            )}
          </div>
        ))}

        {notes.map((note) => (
          <div key={note.id} className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-1.5">
            <p className="text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">Note</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-5">{note.content}</p>
          </div>
        ))}

        {total === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-[9px] text-muted-foreground/60 text-center leading-relaxed px-1">
              Click KIV on any activity to save it here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export function CalendarView({
  tripId,
  days,
  activities: initialActivities,
  activeCategories,
  onActivityClick,
  onAddActivity,
  onAddBooking,
  onAddTransport,
  accommodationBookings,
  onViewBooking,
  onActivityUpdated,
  onSendToKIV,
  onKIVAssignDay,
  weatherByDate,
  weatherLoading,
  memberColorMap,
  memberNameMap,
  filterCreatorId,
}: {
  tripId?: string
  days: string[]
  activities: Activity[]
  activeCategories?: Set<Activity["category"]>
  onActivityClick: (activity: Activity) => void
  onAddActivity?: (day_date: string, start_time: string, time_block: TimeBlock) => void
  onAddBooking?: (day_date: string) => void
  onAddTransport?: (day_date: string) => void
  accommodationBookings?: Booking[]
  onViewBooking?: (bookingId: string) => void
  onActivityUpdated?: (activity: Activity) => void
  onSendToKIV?: (activityId: string) => void
  onKIVAssignDay?: (activityId: string, day: string) => void
  weatherByDate?: Record<string, DailyWeather>
  weatherLoading?: boolean
  memberColorMap?: Map<string, string>
  memberNameMap?: Map<string, string>
  filterCreatorId?: string | null
}) {
  // Local copy for drag-to-reschedule optimistic updates.
  // Kept in sync with the parent prop via the effect below so that realtime
  // events handled by ItineraryBoard flow through here too.
  const [activities, setActivities] = useState<Activity[]>(initialActivities)

  // Sync board-level state changes (realtime inserts/updates/deletes) into the
  // local copy. Skip while a drag is in progress to avoid overwriting the
  // optimistic position mid-gesture; the effect will re-run once the drag
  // finishes and the parent prop stabilises.
  useEffect(() => {
    if (!dragRef.current) {
      setActivities(initialActivities)
    }
  }, [initialActivities])

  console.log("[calendar] rendering:", activities.length, "activities")

  // Drag state lives in a ref so the always-attached window handlers always
  // read the latest value without stale-closure issues.
  const dragRef = useRef<DragState | null>(null)
  const [dragSnap, setDragSnap] = useState<DragState | null>(null)

  // Stable refs for values the window handlers need
  const bodyRef = useRef<HTMLDivElement>(null)
  const daysRef = useRef(days)
  const onClickRef = useRef(onActivityClick)
  const onActivityUpdatedRef = useRef(onActivityUpdated)
  useEffect(() => { daysRef.current = days }, [days])
  useEffect(() => { onClickRef.current = onActivityClick }, [onActivityClick])
  useEffect(() => { onActivityUpdatedRef.current = onActivityUpdated }, [onActivityUpdated])


  const kivActivities = useMemo(
    () => initialActivities.filter((a) => a.is_kiv),
    [initialActivities],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>()
    for (const day of days) m.set(day, [])
    for (const a of activities) {
      if (!a.day_date || a.is_wishlist || a.is_kiv) continue
      if (activeCategories && activeCategories.size > 0 && !activeCategories.has(a.category)) continue
      m.get(a.day_date)?.push(a)
    }
    return m
  }, [days, activities, activeCategories])

  // Sequential pin numbers matching TripMap's ordering (by day_date then start_time)
  const pinNumberMap = useMemo(() => {
    const m = new Map<string, number>()
    const sorted = [...activities]
      .filter((a) => a.location && !a.is_wishlist)
      .sort((a, b) => {
        const dayA = a.day_date ?? "", dayB = b.day_date ?? ""
        if (dayA !== dayB) return dayA < dayB ? -1 : 1
        const tA = a.start_time ?? "99:99", tB = b.start_time ?? "99:99"
        return tA < tB ? -1 : tA > tB ? 1 : 0
      })
    sorted.forEach((a, i) => m.set(a.id, i + 1))
    return m
  }, [activities])

  const accommodationBands = useMemo(
    () => getAccommodationBands(accommodationBookings ?? [], days),
    [accommodationBookings, days],
  )

  const [clickMenu, setClickMenu] = useState<ClickMenu | null>(null)

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: string) {
    // Ignore if a drag just completed (dragRef is already cleared by pointerup, so
    // check a tiny movement threshold via the event's detail — detail=0 means synthetic,
    // detail>=1 means real click; we always proceed for real clicks on empty space).
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const snappedTop = snap(Math.max(0, Math.min(relY, totalH - SLOT_H / 2)))
    const mins = Math.max(HOUR_START * 60, Math.min(topToMins(snappedTop), HOUR_END * 60))
    const startTime = minsToTime(mins)
    const block: TimeBlock = mins < 12 * 60 ? "morning" : mins < 18 * 60 ? "afternoon" : "night"
    setClickMenu({ clientX: e.clientX, clientY: e.clientY, top: snappedTop, day_date: day, start_time: startTime, time_block: block })
  }

  const totalH = HOURS.length * SLOT_H

  // ── Window handlers — attached ONCE on mount ──────────────────────────────
  // Attaching on mount (not via an isDragging gate) means no events are ever
  // dropped between pointerdown and when React finishes a state-update cycle.
  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return

      const dy = e.clientY - d.startY

      if (d.type === "resize") {
        const newH = snap(Math.max(SLOT_H / 2, d.origHeight + dy))
        const updated = { ...d, currentHeight: newH }
        dragRef.current = updated
        setDragSnap(updated)
      } else {
        const rawTop = d.origTop + dy
        const newTop = snap(Math.max(0, Math.min(rawTop, HOURS.length * SLOT_H - SLOT_H / 2)))

        // Derive day column from live bounding rect (accurate even after scroll)
        let newDayIdx = d.origDayIdx
        const rect = bodyRef.current?.getBoundingClientRect()
        if (rect) {
          const relX = e.clientX - rect.left - TIME_COL_W
          const colW = (rect.width - TIME_COL_W) / daysRef.current.length
          newDayIdx = Math.max(0, Math.min(Math.floor(relX / colW), daysRef.current.length - 1))
        }

        const updated = { ...d, currentTop: newTop, currentDayIdx: newDayIdx }
        dragRef.current = updated
        setDragSnap(updated)
      }
    }

    async function handleUp() {
      const d = dragRef.current
      if (!d) return
      // Clear ref + visual immediately so subsequent interactions start fresh
      dragRef.current = null
      setDragSnap(null)

      // Tiny move → treat as click
      const movedV = Math.abs(d.currentTop - d.origTop)
      const movedH = d.currentDayIdx !== d.origDayIdx
      if (d.type === "move" && movedV < SLOT_H / 4 && !movedH) {
        onClickRef.current(d.origActivity)
        return
      }

      // Compute new times
      let newStartTime: string
      let newEndTime: string

      if (d.type === "resize") {
        // Start stays the same; end moves
        newStartTime = d.origActivity.start_time ?? minsToTime(topToMins(d.origTop))
        const startMins = timeToMins(newStartTime)
        const durMins = Math.max(SNAP_MINS, Math.round((d.currentHeight / SLOT_H) * 60))
        newEndTime = minsToTime(startMins + durMins)
      } else {
        // Start moves; duration stays the same
        const newStartMins = topToMins(d.currentTop)
        newStartTime = minsToTime(newStartMins)
        newEndTime = minsToTime(newStartMins + actDurationMins(d.origActivity))
      }

      const days = daysRef.current
      const newDay = days[d.currentDayIdx]
      const startH = timeToMins(newStartTime) / 60
      const newBlock: TimeBlock = startH < 12 ? "morning" : startH < 18 ? "afternoon" : "night"

      const updatedActivity: Activity = {
        ...d.origActivity,
        start_time: newStartTime,
        end_time: newEndTime,
        day_date: newDay,
        time_block: newBlock,
      }

      // Optimistic update — applied before the async DB call so there is no
      // visual snap-back while we wait for the network.
      setActivities((prev) => prev.map((a) => (a.id === d.activityId ? updatedActivity : a)))

      const supabase = createClient()
      const { error } = await supabase
        .from("activities")
        .update({ start_time: newStartTime, end_time: newEndTime, day_date: newDay, time_block: newBlock })
        .eq("id", d.activityId)

      if (error) {
        toast.error("Could not save changes")
        // Revert optimistic update on failure
        setActivities((prev) => prev.map((a) => (a.id === d.activityId ? d.origActivity : a)))
      } else {
        onActivityUpdatedRef.current?.(updatedActivity)
      }
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, []) // Empty deps — attach once, use refs for all runtime values

  // ── Drag start (called from onPointerDown in JSX) ─────────────────────────
  function startDrag(e: React.PointerEvent, activityId: string, type: "move" | "resize") {
    e.preventDefault()
    e.stopPropagation()
    const a = activities.find((x) => x.id === activityId)
    if (!a) return
    const { top, height } = calcPos(a)
    const dayIdx = daysRef.current.indexOf(a.day_date ?? "")
    const state: DragState = {
      type, activityId, origActivity: a,
      startX: e.clientX, startY: e.clientY,
      origTop: top, origHeight: height, origDayIdx: dayIdx,
      currentTop: top, currentHeight: height, currentDayIdx: dayIdx,
    }
    dragRef.current = state
    setDragSnap(state)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const calendarGrid = (
    <div className="flex overflow-hidden rounded-2xl bg-[#FDFAF6]" style={{ border: "0.5px solid #D4C9BC" }}>
    <div className="flex-1 overflow-x-auto min-w-0">
      <div className="min-w-max">

        {/* ── Combined header: bands above, day labels below ── */}
        <div className="z-20 bg-card">

          {/* Accommodation bands */}
          {accommodationBands.length > 0 && (() => {
            const bandsWithRows = assignBandRows(accommodationBands)
            const visibleBands  = bandsWithRows.filter((b) => b.row < MAX_BAND_ROWS)
            const hiddenCount   = bandsWithRows.length - visibleBands.length
            const numRows       = visibleBands.length > 0 ? Math.max(...visibleBands.map((b) => b.row)) + 1 : 0
            if (numRows === 0) return null
            return (
              <div
                style={{
                  borderBottom: "0.5px solid #D4C9BC",
                  display: "grid",
                  gridTemplateColumns: `${TIME_COL_W}px repeat(${days.length}, ${DAY_COL_MIN_W}px)`,
                  gridTemplateRows: `repeat(${numRows}, ${BAND_ROW_H}px)`,
                  rowGap: BAND_GAP,
                  paddingTop: 4,
                  paddingBottom: hiddenCount > 0 ? 2 : 4,
                }}
              >
                {/* Time-column spacers (one per row) */}
                {Array.from({ length: numRows }).map((_, r) => (
                  <div key={`ts-${r}`} style={{ gridColumn: 1, gridRow: r + 1 }} />
                ))}

                {/* Band pills */}
                {visibleBands.map((band) => {
                  const color = HOTEL_COLORS[band.colorIndex]!
                  const clampedStart = Math.max(0, band.startColIndex)
                  const clampedSpan  = Math.min(band.spanCount, days.length - clampedStart)
                  if (clampedStart >= days.length || clampedSpan <= 0) return null
                  return (
                    <div
                      key={band.id}
                      style={{
                        gridColumn: `${clampedStart + 2} / span ${clampedSpan}`,
                        gridRow: band.row + 1,
                        padding: "0 4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onViewBooking?.(band.id)}
                        title={`${band.name} · ${band.nights} night${band.nights !== 1 ? "s" : ""}`}
                        style={{
                          width: "100%",
                          height: BAND_ROW_H - 4,
                          background: color.bg,
                          border: `0.5px solid ${color.border}`,
                          borderRadius: 999,
                          padding: "0 10px 0 8px",
                          fontSize: 11,
                          fontWeight: 500,
                          color: color.text,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          overflow: "hidden",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <BedDouble style={{ width: 11, height: 11, flexShrink: 0, opacity: 0.75 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {band.name} · {band.dateRange}
                        </span>
                      </button>
                    </div>
                  )
                })}

                {/* +N more overflow indicator */}
                {hiddenCount > 0 && (
                  <div
                    style={{
                      gridColumn: `2 / span ${days.length}`,
                      gridRow: numRows + 1,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 8,
                      paddingBottom: 4,
                      fontSize: 10,
                      color: "#6b7280",
                    }}
                  >
                    +{hiddenCount} more hotel{hiddenCount > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Day column headers */}
          <div className="flex" style={{ borderBottom: "0.5px solid #D4C9BC" }}>
            <div className="shrink-0" style={{ width: TIME_COL_W }} />
            {days.map((day) => {
              const isToday = day === todayStr
              const parsed  = parseDateOnly(day)
              return (
                <div
                  key={day}
                  className={cn("shrink-0 px-2 py-2 text-center", isToday && "bg-[#6D8F87]/5")}
                  style={{ width: DAY_COL_MIN_W, borderLeft: "0.5px solid #EDE8E0" }}
                >
                  <div className="inline-flex flex-col items-center gap-0.5">
                    <div className="text-[9px] leading-none uppercase tracking-wide" style={{ color: "#9BA8A6" }}>
                      {format(parsed, "EEE")}
                    </div>
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium"
                      style={isToday ? { backgroundColor: "#6D8F87", color: "white" } : { color: "#2C4A45" }}
                    >
                      {format(parsed, "d")}
                    </div>
                    <div className="text-[9px] leading-none" style={{ color: "#9BA8A6" }}>
                      {format(parsed, "MMM")}
                    </div>
                    {weatherLoading ? (
                      <div className="mt-0.5 h-3 w-10 animate-pulse rounded bg-muted" />
                    ) : weatherByDate?.[day] ? (
                      <div className="mt-0.5 flex items-center gap-0.5 text-[11px]" style={{ color: wmoColor(weatherByDate[day].code) }}>
                        <span>{wmoToDisplay(weatherByDate[day].code).icon}</span>
                        <span>{weatherByDate[day].max}°C</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex" style={{ position: "relative" }}>
          {/* Sticky time-label column */}
          <div className="sticky left-0 z-10 shrink-0 bg-[#FDFAF6]" style={{ width: TIME_COL_W, borderRight: "0.5px solid #EDE8E0" }}>
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: SLOT_H }} className="flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[10px] tabular-nums" style={{ color: "#C8C0B4" }}>{fmtHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const rawActs = byDay.get(day) ?? []
            const laid = layoutActivities(rawActs)
            const timedActs = rawActs
              .filter((a) => a.start_time)
              .sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time))

            return (
              <div
                key={day}
                className="relative shrink-0 cursor-pointer"
                style={{ width: DAY_COL_MIN_W, height: totalH, borderLeft: "0.5px solid #EDE8E0" }}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Alternating 2-hour row tints */}
                {HOURS.map((_, i) => (
                  <div
                    key={`bg-${i}`}
                    className="absolute inset-x-0"
                    style={{
                      top: i * SLOT_H,
                      height: SLOT_H,
                      backgroundColor: Math.floor(i / 2) % 2 === 0 ? "rgba(253,250,246,0.7)" : "rgba(255,251,244,0.7)",
                    }}
                  />
                ))}
                {/* Hour grid lines */}
                {HOURS.map((_, i) => (
                  <div key={i} className="absolute inset-x-0" style={{ top: i * SLOT_H, borderTop: "0.5px solid #EDE8E0" }} />
                ))}

                {/* Gap indicators — free time + driving time between activities */}
                {timedActs.slice(0, -1).map((a, i) => {
                  const b = timedActs[i + 1]
                  if (!b.start_time) return null
                  const { top: aTop, height: aH } = calcPos(a)
                  const { top: bTop } = calcPos(b)
                  // Cards render with height:auto + minHeight, so their actual visual
                  // bottom is always at least MIN_CARD_RENDER_H px below their top.
                  // Use that floor so the gap wrapper starts at the real card bottom.
                  const cardBottom = aTop + Math.max(aH, MIN_CARD_RENDER_H)
                  const connH = bTop - cardBottom
                  if (connH <= 0) return null
                  const aEndMins = a.end_time
                    ? timeToMins(a.end_time)
                    : effectiveStartMins(a) + actDurationMins(a)
                  const gapMins = timeToMins(b.start_time) - aEndMins
                  return (
                    <div
                      key={`gap-${a.id}`}
                      className="absolute overflow-hidden"
                      style={{ top: cardBottom, height: connH, left: 0, right: 0 }}
                    >
                      <GapIndicator
                        gapMinutes={gapMins}
                        gapHeightPx={connH}
                        fromLocation={a.location ?? null}
                        toLocation={b.location ?? null}
                      />
                    </div>
                  )
                })}

                {/* Activity blocks */}
                {laid.map(({ activity: a, col, totalCols }) => {
                  const ds = dragSnap
                  const isThisActivity = ds?.activityId === a.id

                  // When moving to a different day: show ghost in original column,
                  // live block in the target column (rendered by the target column's iteration).
                  const isGhost = isThisActivity && ds!.type === "move" && ds!.currentDayIdx !== dayIdx
                  const isLive  = isThisActivity && ds!.currentDayIdx === dayIdx

                  // Activity belongs to orig day but target is elsewhere — skip live render
                  if (isThisActivity && !isGhost && !isLive) return null

                  const { top: baseTop, height: baseH } = calcPos(a)
                  const top    = isLive ? ds!.currentTop    : baseTop
                  const height = isLive
                    ? (ds!.type === "resize" ? ds!.currentHeight : ds!.origHeight)
                    : baseH

                  const leftPct  = (col / totalCols) * 100
                  const widthPct = (1  / totalCols) * 100

                  const cat = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE.other
                  const pinNum = pinNumberMap.get(a.id)
                  const blockH = Math.max(height, SLOT_H * 0.5)

                  // During resize: fixed height so the drag reflects exactly.
                  // At rest: auto height so wrapped text is never clipped.
                  const isResizing = isLive && ds!.type === "resize"

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "absolute text-xs select-none group/block transition-opacity duration-150",
                        isGhost && "opacity-25",
                        isLive  && "z-30 shadow-lg",
                        filterCreatorId && a.created_by !== filterCreatorId && "opacity-30",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        top,
                        height: isResizing ? ds!.currentHeight : blockH,
                        left:  `calc(${leftPct}%  + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: cat.bg,
                        borderTop: "0.5px solid rgba(212,201,188,0.35)",
                        borderRight: "0.5px solid rgba(212,201,188,0.35)",
                        borderBottom: "0.5px solid rgba(212,201,188,0.35)",
                        borderLeft: `3px solid ${cat.badge}`,
                        borderRadius: "0 8px 8px 0",
                        overflow: "visible",
                      }}
                    >
                      {/* Move handle — whole block except the resize strip */}
                      <div
                        className="relative cursor-grab overflow-hidden px-1.5 py-1 active:cursor-grabbing"
                        style={{ height: "100%", paddingBottom: 10, touchAction: "none", borderRadius: "0 8px 8px 0" }}
                        onPointerDown={(e) => startDrag(e, a.id, "move")}
                      >
                        {/* Numbered pin badge — top-right */}
                        {pinNum && (
                          <div
                            className="absolute top-0.5 right-0.5 flex items-center justify-center rounded-full"
                            style={{
                              width: 15, height: 15,
                              background: cat.badge,
                              color: "white",
                              fontSize: 8,
                              fontWeight: 700,
                              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                              lineHeight: 1,
                              flexShrink: 0,
                              zIndex: 2,
                            }}
                          >
                            {pinNum}
                          </div>
                        )}

                        <div
                          className={cn("text-[11px] font-medium leading-snug", blockH >= 56 ? "line-clamp-2" : "truncate")}
                          style={{
                            color: cat.text,
                            marginRight: pinNum ? 17 : 0,
                          }}
                        >
                          {a.title}
                        </div>
                        {a.start_time && (
                          <div className="mt-0.5 text-[10px] leading-none tabular-nums whitespace-nowrap overflow-hidden" style={{ color: "#6D8F87" }}>
                            {a.start_time.slice(0, 5)}
                            {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                            {a.end_time && blockH >= 48 && (
                              <span style={{ color: "#A9D6C5" }}> ({fmtDuration(actDurationMins(a))})</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Hover tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-max max-w-[200px] group-hover/block:block">
                        <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                          <p className="font-medium leading-snug">{a.title}</p>
                          {a.location && (
                            <p className="mt-0.5 max-w-[180px] truncate text-gray-300">{a.location}</p>
                          )}
                          {a.start_time && (
                            <p className="text-gray-300">
                              {a.start_time.slice(0, 5)}
                              {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Creator attribution dot */}
                      {memberColorMap && a.created_by && memberColorMap.has(a.created_by) && blockH >= 32 && (
                        <div
                          className="absolute bottom-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white ring-[1px] ring-white/50"
                          style={{ backgroundColor: memberColorMap.get(a.created_by) }}
                          title={`Added by ${memberNameMap?.get(a.created_by) ?? "member"}`}
                        >
                          {(memberNameMap?.get(a.created_by) ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}

                      {/* Resize handle */}
                      <div
                        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover/block:opacity-100"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => { e.stopPropagation(); startDrag(e, a.id, "resize") }}
                      >
                        <div className="h-0.5 w-5 rounded-full" style={{ backgroundColor: cat.badge }} />
                      </div>

                      {/* Send to KIV button */}
                      {onSendToKIV && (
                        <button
                          type="button"
                          className="absolute top-0.5 left-0.5 z-10 opacity-0 group-hover/block:opacity-100 transition-opacity rounded px-1 py-0.5 text-[8px] font-semibold bg-amber-100 border border-amber-300 text-amber-700 hover:bg-amber-200 leading-none"
                          onClick={(e) => { e.stopPropagation(); onSendToKIV(a.id) }}
                          title="Save for later (KIV)"
                        >
                          KIV
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Click-to-add ghost preview */}
                {clickMenu?.day_date === day && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-2 border-dashed border-[#A9D6C5]/60 bg-[#A9D6C5]/10"
                    style={{ top: clickMenu.top, height: SLOT_H }}
                  />
                )}

                {/* Drop target ghost when dragging from another day into this column */}
                {dragSnap?.type === "move" &&
                  dragSnap.currentDayIdx === dayIdx &&
                  dragSnap.origDayIdx !== dayIdx && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5"
                      style={{ top: dragSnap.currentTop, height: Math.max(dragSnap.origHeight, SLOT_H * 0.5) }}
                    />
                  )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
    <KIVCalendarColumn
      tripId={tripId ?? ""}
      kivActivities={kivActivities}
      days={days}
      onAssignDay={onKIVAssignDay}
    />
    </div>
  )

  return (
    <>
      {calendarGrid}

      {/* ── Click-to-add popup ── */}
      {clickMenu && (
        <>
          {/* Transparent backdrop — closes the menu */}
          <div className="fixed inset-0 z-40" onClick={() => setClickMenu(null)} />

          <div
            className="fixed z-50 min-w-[172px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            style={{
              top: clickMenu.clientY + 6,
              left: Math.min(clickMenu.clientX, (typeof window !== "undefined" ? window.innerWidth : 800) - 180),
            }}
          >
            {/* Header: day + snapped time */}
            <div className="border-b border-border px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {format(parseDateOnly(clickMenu.day_date), "EEE, MMM d")}
                {" · "}
                {clickMenu.start_time.slice(0, 5)}
              </p>
            </div>

            {/* Options */}
            <div className="p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-secondary"
                onClick={() => {
                  onAddActivity?.(clickMenu.day_date, clickMenu.start_time, clickMenu.time_block)
                  setClickMenu(null)
                }}
              >
                <CalendarPlus className="h-4 w-4 shrink-0 text-[#6D8F87]" />
                Add Activity
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-secondary"
                onClick={() => {
                  onAddBooking?.(clickMenu.day_date)
                  setClickMenu(null)
                }}
              >
                <Ticket className="h-4 w-4 shrink-0 text-[#6D8F87]" />
                Add Booking
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-secondary"
                onClick={() => {
                  onAddTransport?.(clickMenu.day_date)
                  setClickMenu(null)
                }}
              >
                <Bus className="h-4 w-4 shrink-0 text-[#6D8F87]" />
                Add Transport
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
