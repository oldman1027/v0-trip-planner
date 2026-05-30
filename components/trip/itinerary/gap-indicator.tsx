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

  return (
    <div
      style={{ height: gapHeightPx }}
      className="flex items-center justify-center w-full pointer-events-none overflow-hidden"
    >
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  )
}
