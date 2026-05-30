"use client"

import { useTravelTime } from "@/hooks/use-travel-time"

interface GapIndicatorProps {
  gapMinutes: number
  gapHeightPx: number
  fromLocation: string | null
  toLocation: string | null
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function GapIndicator({
  gapMinutes,
  gapHeightPx,
  fromLocation,
  toLocation,
}: GapIndicatorProps) {
  const hasLocations =
    !!fromLocation &&
    !!toLocation &&
    fromLocation.trim().toLowerCase() !== toLocation.trim().toLowerCase()

  const { driveMinutes, loading } = useTravelTime(
    hasLocations ? fromLocation : null,
    hasLocations ? toLocation : null,
  )

  const leftMinutes =
    driveMinutes !== null && driveMinutes > 0 ? gapMinutes - driveMinutes : null

  const content = loading
    ? "···"
    : leftMinutes !== null && leftMinutes < 0
    ? "⚠️ tight"
    : leftMinutes !== null && leftMinutes < 15
    ? `⚠️ ${formatDuration(driveMinutes!)} · ${formatDuration(leftMinutes)} left`
    : hasLocations && driveMinutes !== null && driveMinutes > 0
    ? `🚗 ${formatDuration(driveMinutes)} · ${formatDuration(leftMinutes!)} left`
    : gapMinutes <= 0
    ? "⚠️ tight"
    : formatDuration(gapMinutes)

  return (
    <div
      className="relative flex items-center justify-center w-full pointer-events-none"
      style={{ height: Math.max(gapHeightPx, 28) }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px bg-gray-200"
        style={{ height: "40%" }}
      />
      <span className="relative z-10 text-[10px] text-gray-400 bg-[#FFFBF4] px-1">
        {content}
      </span>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px bg-gray-200"
        style={{ height: "40%" }}
      />
    </div>
  )
}
