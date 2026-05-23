"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, MapPin, Clock, AlertCircle, CalendarCheck, BedDouble, Plane, Utensils, ShoppingBag, Music, MoreHorizontal } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Activity } from "@/lib/types"
import type { ConflictInfo } from "@/lib/time-conflicts"

const CATEGORY_META: Record<Activity["category"], { label: string; cls: string }> = {
  food:          { label: "Food & Dining",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  attraction:    { label: "Attraction",     cls: "bg-blue-100 text-blue-700 border-blue-200" },
  transport:     { label: "Transport",      cls: "bg-slate-100 text-slate-700 border-slate-200" },
  accommodation: { label: "Accommodation",  cls: "bg-purple-100 text-purple-700 border-purple-200" },
  shopping:      { label: "Shopping",       cls: "bg-pink-100 text-pink-700 border-pink-200" },
  entertainment: { label: "Entertainment",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  other:         { label: "Other",          cls: "bg-secondary text-muted-foreground border-border" },
}

const CATEGORY_PLACEHOLDER: Record<Activity["category"], { bg: string; icon: React.ComponentType<{ className?: string }>; iconCls: string }> = {
  food:          { bg: "bg-orange-100", icon: Utensils,       iconCls: "text-orange-300" },
  attraction:    { bg: "bg-green-100",  icon: MapPin,         iconCls: "text-green-300" },
  transport:     { bg: "bg-gray-100",   icon: Plane,          iconCls: "text-gray-300" },
  accommodation: { bg: "bg-blue-100",   icon: BedDouble,      iconCls: "text-blue-300" },
  shopping:      { bg: "bg-pink-100",   icon: ShoppingBag,    iconCls: "text-pink-300" },
  entertainment: { bg: "bg-purple-100", icon: Music,          iconCls: "text-purple-300" },
  other:         { bg: "bg-teal-100",   icon: MoreHorizontal, iconCls: "text-teal-300" },
}

export function ActivityCard({
  activity,
  dragging,
  onClick,
  conflicts,
  hasBooking,
  onBookingClick,
}: {
  activity: Activity
  dragging?: boolean
  onClick?: () => void
  conflicts?: ConflictInfo[]
  hasBooking?: boolean
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

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      style={dragging ? undefined : style}
      className={cn(
        "group/card relative flex items-stretch gap-3 rounded-xl border border-border bg-card p-3 transition-shadow",
        conflicts && conflicts.length > 0 && "border-yellow-500/50 bg-yellow-50/20 dark:bg-yellow-900/10",
        isDragging && !dragging && "opacity-40",
        dragging && "shadow-md ring-1 ring-primary/30",
      )}
    >
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
            {hasBooking && (
              <span
                role={onBookingClick ? "button" : undefined}
                tabIndex={onBookingClick ? 0 : undefined}
                onClick={onBookingClick ? (e) => { e.stopPropagation(); onBookingClick() } : undefined}
                onKeyDown={onBookingClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onBookingClick() } } : undefined}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
                  onBookingClick && "cursor-pointer hover:bg-emerald-100 transition-colors",
                )}
              >
                <CalendarCheck className="h-2.5 w-2.5" aria-hidden />
                Booked
              </span>
            )}
            {activity.cost_amount != null ? (
              <span className="tabular rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                {formatCost(activity.cost_amount, activity.cost_currency)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {activity.category && activity.category !== "other" && CATEGORY_META[activity.category] && (
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", CATEGORY_META[activity.category]!.cls)}>
              {CATEGORY_META[activity.category]!.label}
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
          {activity.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {activity.location}
            </span>
          ) : null}
          {time ? (
            <span className="tabular inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {time}
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
function formatCost(amount: number, currency: string | null) {
  const c = currency ?? "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${c} ${amount}`
  }
}
