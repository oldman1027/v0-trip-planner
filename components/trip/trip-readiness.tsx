"use client"

import { Check, AlertTriangle, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReadinessStats } from "@/lib/readiness"

type Item = { label: string; status: "ok" | "warning" | "missing" }

function buildChecklist(stats: ReadinessStats): Item[] {
  const items: Item[] = []

  // ── Accommodation ───────────────────────────────────────────────────────────
  if (stats.accommodationStatus === "booked") {
    items.push({ label: "Accommodation booked", status: "ok" })
  } else if (stats.accommodationStatus === "unbooked") {
    items.push({ label: "Accommodation not booked", status: "warning" })
  } else {
    items.push({ label: "No accommodation planned", status: "missing" })
  }

  // ── Transport ───────────────────────────────────────────────────────────────
  if (stats.transportStatus === "booked") {
    items.push({ label: "Transport booked", status: "ok" })
  } else if (stats.transportStatus === "unbooked") {
    items.push({ label: "Transport not booked", status: "warning" })
  } else {
    items.push({ label: "No transport planned", status: "missing" })
  }

  // ── Scheduling conflicts ────────────────────────────────────────────────────
  if (stats.conflictCount > 0) {
    items.push({
      label: `${stats.conflictCount} scheduling conflict${stats.conflictCount !== 1 ? "s" : ""}`,
      status: "warning",
    })
  }

  // ── Payment status summary ──────────────────────────────────────────────────
  if (stats.pendingPayment > 0) {
    items.push({
      label: `${stats.pendingPayment} booking${stats.pendingPayment !== 1 ? "s" : ""} pending payment`,
      status: "warning",
    })
  }
  if (stats.confirmed > 0) {
    items.push({
      label: `${stats.confirmed} ${stats.confirmed === 1 ? "booking" : "bookings"} confirmed`,
      status: "ok",
    })
  }

  return items
}

const ICON: Record<Item["status"], React.ElementType> = {
  ok:      Check,
  warning: AlertTriangle,
  missing: Minus,
}
const ICON_CLS: Record<Item["status"], string> = {
  ok:      "text-emerald-500",
  warning: "text-amber-500",
  missing: "text-muted-foreground/60",
}
const TEXT_CLS: Record<Item["status"], string> = {
  ok:      "text-foreground",
  warning: "text-amber-700 dark:text-amber-400",
  missing: "text-muted-foreground",
}

export function TripReadiness({ stats }: { stats: ReadinessStats }) {
  const { score } = stats

  const barColor =
    score >= 70 ? "bg-emerald-500"
    : score >= 40 ? "bg-amber-500"
    : "bg-red-400"

  const statusLabel =
    score >= 70 ? "On track"
    : score >= 40 ? "In progress"
    : "Just starting"

  const checklist = buildChecklist(stats)

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Trip Readiness</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-sm font-semibold">{score}%</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              score >= 70
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : score >= 40
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barColor)}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {checklist.map((item) => {
          const Icon = ICON[item.status]
          return (
            <div key={item.label} className="flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", ICON_CLS[item.status])} aria-hidden />
              <span className={cn("text-xs", TEXT_CLS[item.status])}>{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
