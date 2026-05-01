"use client"

import { useEffect, useState } from "react"
import { addDays, subDays, parseISO, format, differenceInDays } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { geocodeDestination, fetchWeatherForecast, type WeatherData } from "@/lib/weather"

const MAX_FORECAST_DAYS = 16

export function WeatherForecast({
  destination,
  startDate,
  endDate,
}: {
  destination: string | null
  startDate: string
  endDate: string
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!destination) {
      setLoading(false)
      return
    }
    let mounted = true
    async function load() {
      if (!destination) return
      const coords = await geocodeDestination(destination)
      if (!coords || !mounted) return
      const data = await fetchWeatherForecast(coords.latitude, coords.longitude, destination)
      if (mounted) {
        setWeather(data)
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [destination])

  if (!destination) return null
  if (loading)
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
      </Card>
    )

  // Desired window: 3 days before trip start → 1 day after trip end
  const windowStart = subDays(parseISO(startDate), 3)
  const windowEnd   = addDays(parseISO(endDate), 1)
  const windowStartStr = format(windowStart, "yyyy-MM-dd")
  const windowEndStr   = format(windowEnd,   "yyyy-MM-dd")

  // Check if trip is too far in the future for the API
  const daysUntilStart = differenceInDays(parseISO(startDate), new Date())
  const tripTooFar = daysUntilStart > MAX_FORECAST_DAYS

  if (tripTooFar) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Weather in {destination}</span>
          </CardTitle>
          <CardDescription>
            Forecast available ~{daysUntilStart - MAX_FORECAST_DAYS} days before your trip starts
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!weather) return null

  // Filter the 16-day forecast to our desired window
  const forecast = weather.forecast.filter(
    (d) => d.date >= windowStartStr && d.date <= windowEndStr,
  )

  if (forecast.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Weather in {weather.location}</span>
          <span className="text-3xl">{weather.current.icon}</span>
        </CardTitle>
        <CardDescription>
          {weather.current.temperature}°F · {weather.current.description}
          {" · "}showing {format(windowStart, "MMM d")} – {format(windowEnd, "MMM d")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {forecast.map((day) => {
            const date = parseISO(day.date)
            const isTripDay = day.date >= startDate && day.date <= endDate
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center rounded-lg border p-3 text-center text-sm transition-colors ${
                  isTripDay
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card/50"
                }`}
              >
                <div className={`text-xs font-medium ${isTripDay ? "text-primary" : "text-muted-foreground"}`}>
                  {format(date, "EEE")}
                  <span className="ml-1 text-[10px] opacity-70">{format(date, "MMM d")}</span>
                </div>
                <div className="my-2 text-2xl">{day.icon}</div>
                <div className="font-semibold">
                  {day.high}°
                  <span className="text-xs text-muted-foreground"> / {day.low}°</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{day.description}</div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
