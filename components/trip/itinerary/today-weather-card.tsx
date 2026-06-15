"use client"

import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"
import { wmoToDisplay } from "@/lib/weather-utils"
import type { DailyWeather } from "@/app/api/weather/route"

type Props = {
  weatherByDate: Record<string, DailyWeather>
  weatherLoading: boolean
  days: string[]
  destination: string | null
}

function rainColor(chance: number): string {
  if (chance > 60) return "#60A5FA"
  if (chance >= 30) return "#EF9F27"
  return "#22C55E"
}

export function TodayWeatherCard({ weatherByDate, weatherLoading, days, destination }: Props) {
  if (weatherLoading || days.length === 0) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = days.includes(todayStr)
  const displayDate = isToday ? todayStr : days[0]!
  const cardLabel = isToday ? "Today's Weather" : "Day 1 Weather"
  const weather = weatherByDate[displayDate]

  if (!weather) return null

  const parsed = parseDateOnly(displayDate)
  const { icon, label: conditionLabel } = wmoToDisplay(weather.code)
  const cityName = destination?.split(",")[0]?.trim() ?? ""

  return (
    <div
      className="mx-2 mb-2 shrink-0"
      style={{
        background: "#FDFAF6",
        border: "0.5px solid #D4C9BC",
        borderRadius: 16,
        padding: "14px 16px",
      }}
    >
      {/* Header label */}
      <div
        className="mb-0.5 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "#A9D6C5" }}
      >
        {cardLabel}
      </div>
      {/* City + date */}
      <div className="mb-3 text-[11px]" style={{ color: "#6D8F87" }}>
        {cityName ? `${cityName} · ` : ""}
        {format(parsed, "EEE MMM d")}
      </div>

      {/* Big emoji + temp + condition */}
      <div className="mb-2 flex items-center gap-2.5">
        <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
        <div>
          <div className="text-[22px] font-medium leading-none" style={{ color: "#2C4A45" }}>
            {weather.max}°C
          </div>
          <div className="mt-0.5 text-[13px]" style={{ color: "#6D8F87" }}>
            {conditionLabel}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "0.5px", background: "#D4C9BC", margin: "10px 0" }} />

      {/* Stat rows */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "#9BA8A6" }}>💧 Rain chance</span>
          <span className="font-medium" style={{ color: rainColor(weather.rainChance) }}>
            {weather.rainChance}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "#9BA8A6" }}>💨 Wind</span>
          <span className="font-medium" style={{ color: "#2C4A45" }}>
            {weather.windspeedMax} km/h
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "#9BA8A6" }}>🌡 High / Low</span>
          <span className="font-medium" style={{ color: "#2C4A45" }}>
            {weather.max}° / {weather.min}°
          </span>
        </div>
      </div>
    </div>
  )
}
