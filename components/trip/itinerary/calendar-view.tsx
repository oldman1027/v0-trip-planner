"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Map as MapIcon, CalendarPlus, Ticket, Bus } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseDateOnly } from "@/lib/dates"
import { createClient } from "@/lib/supabase/client"
import { TripMap } from "@/components/trip/overview/trip-map"
import type { Activity, TimeBlock } from "@/lib/types"
import { toast } from "sonner"

// ── Green / turquoise palette — all categories stay in the same hue family ─
const CATEGORY_STYLE: Record<
  Activity["category"],
  { bg: string; border: string; text: string; badge: string }
> = {
  food:          { bg: "#cdeee7", border: "#8AD0C0", text: "#1a5048", badge: "#369383" },
  attraction:    { bg: "#d4f0eb", border: "#80d8dd", text: "#1a4a50", badge: "#27ba76" },
  transport:     { bg: "#dcf2ec", border: "#27ba76", text: "#1a5c38", badge: "#1a8053" },
  accommodation: { bg: "#e8f5f0", border: "#B1DDC6", text: "#1a5c38", badge: "#27ba76" },
  shopping:      { bg: "#d0ece7", border: "#369383", text: "#1a4a46", badge: "#8AD0C0" },
  entertainment: { bg: "#e2f6f2", border: "#80d8dd", text: "#1a4a50", badge: "#369383" },
  other:         { bg: "#f0faf7", border: "#B1DDC6", text: "#1a5c38", badge: "#8AD0C0" },
}

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_START = 6
const HOUR_END = 23
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
const SLOT_H = 38        // px per hour  →  18 × 38 = 684 px total
const SNAP_MINS = 15
const TIME_COL_W = 52
const DAY_COL_MIN_W = 100  // narrower so 7 days fit without horizontal scroll
const BLOCK_HOUR: Record<string, number> = { morning: 7, afternoon: 12, night: 19 }

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
  const totalCols = Math.max(1, colEnds.length)
  return sorted.map((a, i) => ({ activity: a, col: colFor[i], totalCols }))
}
function fmtHour(h: number): string {
  if (h === 12) return "12p"
  return h < 12 ? `${h}a` : `${h - 12}p`
}
function fmtGap(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Component ──────────────────────────────────────────────────────────────
export function CalendarView({
  days,
  activities: initialActivities,
  activeCategories,
  destination,
  onActivityClick,
  onAddActivity,
  onAddBooking,
  onAddTransport,
}: {
  days: string[]
  activities: Activity[]
  activeCategories?: Set<Activity["category"]>
  destination?: string | null
  onActivityClick: (activity: Activity) => void
  onAddActivity?: (day_date: string, start_time: string, time_block: TimeBlock) => void
  onAddBooking?: (day_date: string) => void
  onAddTransport?: (day_date: string) => void
}) {
  // Local copy — initialised once on mount (views are mutually exclusive so
  // CalendarView always remounts with fresh data when switching back to it).
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [showMap, setShowMap] = useState(false)

  // Drag state lives in a ref so the always-attached window handlers always
  // read the latest value without stale-closure issues.
  const dragRef = useRef<DragState | null>(null)
  const [dragSnap, setDragSnap] = useState<DragState | null>(null)

  // Stable refs for values the window handlers need
  const bodyRef = useRef<HTMLDivElement>(null)
  const daysRef = useRef(days)
  const onClickRef = useRef(onActivityClick)
  useEffect(() => { daysRef.current = days }, [days])
  useEffect(() => { onClickRef.current = onActivityClick }, [onActivityClick])

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>()
    for (const day of days) m.set(day, [])
    for (const a of activities) {
      if (!a.day_date || a.is_wishlist) continue
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

      // Optimistic update — applied before the async DB call so there is no
      // visual snap-back while we wait for the network.
      setActivities((prev) =>
        prev.map((a) =>
          a.id === d.activityId
            ? { ...a, start_time: newStartTime, end_time: newEndTime, day_date: newDay, time_block: newBlock }
            : a,
        ),
      )

      const supabase = createClient()
      const { error } = await supabase
        .from("activities")
        .update({ start_time: newStartTime, end_time: newEndTime, day_date: newDay, time_block: newBlock })
        .eq("id", d.activityId)

      if (error) {
        toast.error("Could not save changes")
        // Revert optimistic update on failure
        setActivities((prev) => prev.map((a) => (a.id === d.activityId ? d.origActivity : a)))
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
  const calendarGrid = (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div style={{ minWidth: TIME_COL_W + days.length * DAY_COL_MIN_W }}>

        {/* Sticky day header */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card">
          <div className="shrink-0 bg-card" style={{ width: TIME_COL_W }} />
          {days.map((day, idx) => (
            <div
              key={day}
              className="flex-1 border-l border-border px-2 py-2 text-center"
              style={{ minWidth: DAY_COL_MIN_W }}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Day {idx + 1}
              </div>
              <div className="font-serif text-xs leading-snug">{format(parseDateOnly(day), "EEE, MMM d")}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex">
          {/* Sticky time-label column */}
          <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card" style={{ width: TIME_COL_W }}>
            {HOURS.map((hour) => (
              <div key={hour} style={{ height: SLOT_H }} className="flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtHour(hour)}</span>
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
                className="relative flex-1 border-l border-border cursor-pointer"
                style={{ minWidth: DAY_COL_MIN_W, height: totalH }}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Hour grid lines */}
                {HOURS.map((_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-border/40" style={{ top: i * SLOT_H }} />
                ))}
                {HOURS.map((_, i) => (
                  <div key={`hh${i}`} className="absolute inset-x-0 border-t border-dashed border-border/20" style={{ top: i * SLOT_H + SLOT_H / 2 }} />
                ))}

                {/* Travel connectors */}
                {timedActs.slice(0, -1).map((a, i) => {
                  const b = timedActs[i + 1]
                  if (!a.end_time || !b.start_time) return null
                  const gapMins = timeToMins(b.start_time) - timeToMins(a.end_time)
                  if (gapMins <= 0) return null
                  const { top: aTop, height: aH } = calcPos(a)
                  const { top: bTop } = calcPos(b)
                  const connH = bTop - (aTop + aH)
                  if (connH < 10) return null
                  return (
                    <div
                      key={`conn-${a.id}`}
                      className="absolute pointer-events-none flex flex-col items-center"
                      style={{ top: aTop + aH, height: connH, left: 0, right: 0 }}
                    >
                      <div className="w-px flex-1 border-l border-dashed border-muted-foreground/30" />
                      <span className="my-0.5 whitespace-nowrap rounded-full border border-border/50 bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground/60">
                        {fmtGap(gapMins)}
                      </span>
                      <div className="w-px flex-1 border-l border-dashed border-muted-foreground/30" />
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
                        "absolute rounded-lg border text-xs select-none group/block overflow-hidden",
                        isGhost && "opacity-25",
                        isLive  && "z-30 shadow-lg",
                      )}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        top,
                        height:    isResizing ? ds!.currentHeight : "auto",
                        minHeight: isResizing ? 0 : blockH,
                        left:  `calc(${leftPct}%  + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: cat.bg,
                        borderColor: cat.border,
                      }}
                    >
                      {/* Move handle — whole block except the resize strip */}
                      <div
                        className="relative cursor-grab px-1.5 py-1 active:cursor-grabbing"
                        style={{ paddingBottom: 10, touchAction: "none" }}
                        onPointerDown={(e) => startDrag(e, a.id, "move")}
                      >
                        {/* Numbered pin badge */}
                        {pinNum && (
                          <div
                            className="absolute top-0.5 left-0.5 flex items-center justify-center rounded-full"
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
                          className="text-[11px] font-semibold leading-snug"
                          style={{
                            color: cat.text,
                            marginLeft: pinNum ? 17 : 0,
                            whiteSpace: "normal",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {a.title}
                        </div>
                        {a.start_time && (
                          <div
                            className="mt-0.5 text-[9px] leading-none tabular-nums"
                            style={{ color: cat.text, opacity: 0.7 }}
                          >
                            {a.start_time.slice(0, 5)}
                            {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                          </div>
                        )}
                      </div>

                      {/* Resize handle */}
                      <div
                        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover/block:opacity-100"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => { e.stopPropagation(); startDrag(e, a.id, "resize") }}
                      >
                        <div className="h-0.5 w-5 rounded-full" style={{ backgroundColor: cat.badge }} />
                      </div>
                    </div>
                  )
                })}

                {/* Click-to-add ghost preview */}
                {clickMenu?.day_date === day && (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-2 border-dashed border-emerald-400/50 bg-emerald-50/40"
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
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Controls row */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            showMap
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
          )}
        >
          <MapIcon className="h-3.5 w-3.5" aria-hidden />
          {showMap ? "Hide map" : "Show map"}
        </button>
      </div>

      {/* Split layout: calendar left, map right on lg+ */}
      <div
        className={cn(
          showMap && "grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        {calendarGrid}

        {showMap && (
          <div className="lg:sticky lg:top-[130px]">
            <TripMap
              activities={activities}
              destination={destination ?? null}
              days={days}
              className="relative overflow-hidden rounded-2xl border border-border"
              containerClassName="h-80 w-full bg-muted/40 lg:h-[680px]"
            />
          </div>
        )}
      </div>

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
                <CalendarPlus className="h-4 w-4 shrink-0 text-emerald-600" />
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
                <Ticket className="h-4 w-4 shrink-0 text-emerald-600" />
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
                <Bus className="h-4 w-4 shrink-0 text-emerald-600" />
                Add Transport
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
