"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, MapPin, Clock, AlertCircle, CalendarCheck, BedDouble, Plane, Utensils, MoreHorizontal } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Activity } from "@/lib/types"
import type { ConflictInfo } from "@/lib/time-conflicts"

const CATEGORY_META: Record<Activity["category"], { label: string; cls: string }> = {
  dining:        { label: "Dining",        cls: "bg-orange-100 text-orange-700 border-orange-200" },
  experiences:   { label: "Experiences",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  transport:     { label: "Transport",     cls: "bg-slate-100 text-slate-700 border-slate-200" },
  accommodation: { label: "Accommodation", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  other:         { label: "Other",         cls: "bg-secondary text-muted-foreground border-border" },
}

const CATEGORY_ACCENT: Record<Activity["category"], string> = {
  dining:        "bg-[#F97316]",
  experiences:   "bg-[#60A5FA]",
  transport:     "bg-[#94A3B8]",
  accommodation: "bg-[#A78BFA]",
  other:         "bg-[#CBD5E1]",
}

const CATEGORY_DOT: Record<Activity["category"], string> = {
  dining:        "bg-[#F97316]",
  experiences:   "bg-[#60A5FA]",
  transport:     "bg-[#94A3B8]",
  accommodation: "bg-[#A78BFA]",
  other:         "bg-[#CBD5E1]",
}

const CATEGORY_PLACEHOLDER: Record<Activity["category"], { bg: string; icon: React.ComponentType<{ className?: string }>; iconCls: string }> = {
  dining:        { bg: "bg-orange-100",    icon: Utensils,       iconCls: "text-orange-300" },
  experiences:   { bg: "bg-[#A9D6C5]/30", icon: MapPin,          iconCls: "text-[#6D8F87]" },
  transport:     { bg: "bg-gray-100",      icon: Plane,           iconCls: "text-gray-300" },
  accommodation: { bg: "bg-blue-100",      icon: BedDouble,       iconCls: "text-blue-300" },
  other:         { bg: "bg-[#A9D6C5]/20",  icon: MoreHorizontal,  iconCls: "text-[#6D8F87]" },
}

export type BookingStatus = "not-required" | "pending" | "booked"

export function ActivityCard({
  activity,
  dragging,
  onClick,
  conflicts,
  bookingStatus,
  onBookingClick,
}: {
  activity: Activity
  dragging?: boolean
  onClick?: () => void
  conflicts?: ConflictInfo[]
  bookingStatus?: BookingStatus
  onBookingClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    disabled: dragging,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [imgError, setImgError] = useState(false)
  const time = formatTimeRange(activity.start_time, activity.end_time)
  const validPhoto = activity.photo_url?.startsWith("https://") && !imgError
  const placeholder = CATEGORY_PLACEHOLDER[activity.category] ?? CATEGORY_PLACEHOLDER.other
  const PlaceholderIcon = placeholder.icon
  const shortLocation = activity.location ? activity.location.split(",")[0].trim() : null

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      style={{
        ...(dragging ? {} : style),
        border: conflicts && conflicts.length > 0 ? "0.5px solid rgba(234,179,8,0.4)" : "0.5px solid #D4C9BC",
      }}
      className={cn(
        "group/card relative flex overflow-hidden rounded-2xl bg-[#FDFAF6] transition-shadow duration-150",
        "hover:shadow-md",
        conflicts && conflicts.length > 0 && "bg-yellow-50/20",
        isDragging && !dragging && "opacity-40",
        dragging && "shadow-md ring-1 ring-primary/30",
      )}
    >
      {/* Left category accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px]",
        CATEGORY_ACCENT[activity.category] ?? CATEGORY_ACCENT.other,
      )} />

      {/* Card content — pl-[14px] clears the 3px accent bar */}
      <div className="flex flex-1 min-w-0 items-stretch gap-3 p-3 pl-[14px]">
      {validPhoto ? (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activity.photo_url!}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className={cn("h-16 w-16 shrink-0 rounded-lg flex items-center justify-center", placeholder.bg)} aria-hidden>
          <PlaceholderIcon className={cn("w-8 h-8", placeholder.iconCls)} />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 flex-col items-start text-left"
        disabled={dragging}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 truncate font-medium leading-tight">{activity.title}</div>
          <div className="flex shrink-0 items-center gap-1.5">
            {(bookingStatus === "booked" || bookingStatus === "pending") && (
              <span
                role={onBookingClick ? "button" : undefined}
                tabIndex={onBookingClick ? 0 : undefined}
                onClick={onBookingClick ? (e) => { e.stopPropagation(); onBookingClick() } : undefined}
                onKeyDown={onBookingClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onBookingClick() } } : undefined}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  bookingStatus === "booked"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
                  onBookingClick && "cursor-pointer hover:opacity-80",
                )}
              >
                <CalendarCheck className="h-2.5 w-2.5" aria-hidden />
                {bookingStatus === "booked" ? "Booked" : "Pending"}
              </span>
            )}
            {activity.cost_amount != null ? (
              <span className="tabular rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                {formatCost(activity.cost_amount, activity.cost_currency)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {activity.category && activity.category !== "other" && CATEGORY_META[activity.category] && (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", CATEGORY_DOT[activity.category])} />
              <span className="text-[10px] text-muted-foreground">{CATEGORY_META[activity.category]!.label}</span>
            </span>
          )}
          {conflicts && conflicts.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label={`${conflicts.length} scheduling conflict${conflicts.length !== 1 ? "s" : ""}`}
                  className="inline-flex cursor-default items-center gap-1 text-yellow-600 dark:text-yellow-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  <span className="text-[10px] font-medium">
                    {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] space-y-1 text-left">
                {conflicts.map((c) => (
                  <p key={c.withId} className="flex items-start gap-1.5 leading-snug">
                    <span aria-hidden className="mt-px shrink-0">⚠</span>
                    {c.message}
                  </p>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
          {shortLocation ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {shortLocation}
            </span>
          ) : null}
          {time ? (
            <span className="tabular inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">
                {time}
                {activity.start_time && activity.end_time && (
                  <span className="ml-1 text-muted-foreground/60">({formatDuration(activity.start_time, activity.end_time)})</span>
                )}
              </span>
            </span>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        aria-label="Drag to reorder"
        className="flex w-6 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/card:opacity-100 active:cursor-grabbing"
        {...(dragging ? {} : attributes)}
        {...(dragging ? {} : listeners)}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      </div>
    </div>
  )
}

function formatTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  if (start && end) return `${stripSec(start)} – ${stripSec(end)}`
  if (start) return stripSec(start)
  return stripSec(end!)
}
function stripSec(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t
}
function formatDuration(start: string, end: string): string {
  const toMins = (t: string) => { const p = t.split(":").map(Number); return (p[0] ?? 0) * 60 + (p[1] ?? 0) }
  const diff = toMins(end) - toMins(start)
  if (diff <= 0) return ""
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatCost(amount: number, currency: string | null) {
  const c = currency ?? "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${c} ${amount}`
  }
}
