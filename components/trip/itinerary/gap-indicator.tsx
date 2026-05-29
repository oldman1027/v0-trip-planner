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

  if (gapMinutes < 15 || gapHeightPx < 40) {
    return <div style={{ height: gapHeightPx }} />
  }

  const leftMinutes =
    driveMinutes !== null && driveMinutes > 0 ? gapMinutes - driveMinutes : null
  const isTight = leftMinutes !== null && leftMinutes < 0

  return (
    <div
      className="relative flex items-center justify-center w-full pointer-events-none"
      style={{ height: gapHeightPx }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px bg-gray-200"
        style={{ height: "42%" }}
      />

      <div
        className={`relative z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] bg-white ${
          isTight ? "border-red-200 text-red-400" : "border-gray-200 text-gray-400"
        }`}
      >
        {loading ? (
          <span className="text-gray-300">···</span>
        ) : isTight ? (
          <span>⚠️ 🚗 {formatDuration(driveMinutes!)} · tight!</span>
        ) : hasLocations && driveMinutes !== null && driveMinutes > 0 ? (
          <span>🚗 {formatDuration(driveMinutes)} · {formatDuration(leftMinutes!)} left</span>
        ) : (
          <span>{formatDuration(gapMinutes)} left</span>
        )}
      </div>

      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px bg-gray-200"
        style={{ height: "42%" }}
      />
    </div>
  )
}
