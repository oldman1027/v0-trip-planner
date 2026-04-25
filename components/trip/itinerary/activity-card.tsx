"use client"

import Image from "next/image"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, MapPin, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Activity } from "@/lib/types"

export function ActivityCard({
  activity,
  dragging,
  onClick,
  hasConflict,
  conflictCount,
}: {
  activity: Activity
  dragging?: boolean
  onClick?: () => void
  hasConflict?: boolean
  conflictCount?: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    disabled: dragging,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const time = formatTimeRange(activity.start_time, activity.end_time)

  return (
    <div
      ref={dragging ? undefined : setNodeRef}
      style={dragging ? undefined : style}
      className={cn(
        "group/card relative flex items-stretch gap-3 rounded-xl border border-border bg-card p-3 transition-shadow",
        hasConflict && "border-yellow-500/50 bg-yellow-50/20 dark:bg-yellow-900/10",
        isDragging && !dragging && "opacity-40",
        dragging && "shadow-md ring-1 ring-primary/30",
      )}
    >
      {activity.photo_url ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image src={activity.photo_url || "/placeholder.svg"} alt="" fill sizes="64px" className="object-cover" />
        </div>
      ) : (
        <div className="h-16 w-16 shrink-0 rounded-lg bg-secondary" aria-hidden />
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 flex-col items-start text-left"
        disabled={dragging}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="font-medium leading-tight">{activity.title}</div>
          {activity.cost_amount != null ? (
            <span className="tabular shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
              {formatCost(activity.cost_amount, activity.cost_currency)}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {hasConflict ? (
            <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-3 w-3" aria-hidden />
              {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}
            </span>
          ) : null}
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
