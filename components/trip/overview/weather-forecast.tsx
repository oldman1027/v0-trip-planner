"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { geocodeDestination, fetchWeatherForecast, type WeatherData } from "@/lib/weather"

export function WeatherForecast({ destination, startDate }: { destination: string | null; startDate: string }) {
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
    return () => {
      mounted = false
    }
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
  if (!weather) return null

  const startIdx = Math.max(0, weather.forecast.findIndex((d) => d.date >= startDate))
  const forecast = weather.forecast.slice(startIdx, Math.min(startIdx + 7, weather.forecast.length))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Weather in {weather.location}</span>
          <span className="text-3xl">{weather.current.icon}</span>
        </CardTitle>
        <CardDescription>
          {weather.current.temperature}°F · {weather.current.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {forecast.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center rounded-lg border border-border bg-card/50 p-3 text-center text-sm"
            >
              <div className="font-medium text-xs text-muted-foreground">
                {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="my-2 text-2xl">{day.icon}</div>
              <div className="font-semibold">
                {day.high}°
                <span className="text-xs text-muted-foreground"> / {day.low}°</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{day.description}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
