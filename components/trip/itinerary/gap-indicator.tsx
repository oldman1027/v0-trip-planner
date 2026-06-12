"use client"

import { useTravelTime } from "@/hooks/use-travel-time"

interface GapIndicatorProps {
  gapMinutes: number
  gapHeightPx: number
  fromLocation: string | null
  toLocation: string | null
}

export function GapIndicator({
  gapMinutes,
  gapHeightPx,
  fromLocation,
  toLocation,
}: GapIndicatorProps) {
  const { driveMinutes, loading } = useTravelTime(fromLocation, toLocation)

  const fmt = (m: number) =>
    m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`

  let label = ""
  if (loading) {
    label = "🚗 ···"
  } else if (driveMinutes !== null && fromLocation && toLocation) {
    const left = gapMinutes - driveMinutes
    label =
      left <= 0
        ? `⚠️ 🚗 ${fmt(driveMinutes)}`
        : `🚗 ${fmt(driveMinutes)} · ${fmt(left)} left`
  } else {
    label = fmt(gapMinutes)
  }

  const freeBuffer = driveMinutes !== null ? gapMinutes - driveMinutes : gapMinutes
  const textColor = freeBuffer < 15 ? "#F97316" : "#A9D6C5"

  return (
    <div
      style={{ height: gapHeightPx }}
      className="relative flex items-center justify-center w-full pointer-events-none overflow-hidden"
    >
      {/* Thin dotted connector line */}
      <div
        className="absolute top-0 bottom-0"
        style={{ left: "50%", width: 1, borderLeft: "1px dotted #A9D6C5", transform: "translateX(-50%)" }}
      />
      <span
        className="relative z-10 text-[9px] px-0.5"
        style={{ color: textColor, background: "transparent" }}
      >
        {label}
      </span>
    </div>
  )
}
