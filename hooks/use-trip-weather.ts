"use client"

import { useState, useEffect, useRef } from "react"
import { geocodeDestination } from "@/lib/weather"
import type { DailyWeather, HourlySlot } from "@/app/api/weather/route"

export type { DailyWeather, HourlySlot }

type TripLike = {
  destination: string | null
  start_date: string
  end_date: string
}

type WeatherResult = {
  weatherByDate: Record<string, DailyWeather>
  hourlyByDate: Record<string, HourlySlot[]>
  loading: boolean
  error: boolean
}

type Cached = {
  weatherByDate: Record<string, DailyWeather>
  hourlyByDate: Record<string, HourlySlot[]>
}

const cache = new Map<string, Cached>()

export function useTripWeather(trip: TripLike): WeatherResult {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeather>>({})
  const [hourlyByDate, setHourlyByDate] = useState<Record<string, HourlySlot[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!trip.destination) return

    cancelledRef.current = false
    const cacheKey = `${trip.destination}|${trip.start_date}|${trip.end_date}`

    const cached = cache.get(cacheKey)
    if (cached) {
      setWeatherByDate(cached.weatherByDate)
      setHourlyByDate(cached.hourlyByDate)
      return
    }

    setLoading(true)
    setError(false)

    async function load() {
      try {
        const coords = await geocodeDestination(trip.destination!)
        if (!coords || cancelledRef.current) return

        const params = new URLSearchParams({
          lat: String(coords.latitude),
          lng: String(coords.longitude),
          start_date: trip.start_date,
          end_date: trip.end_date,
        })

        const res = await fetch(`/api/weather?${params}`)
        if (!res.ok || cancelledRef.current) return

        const data = (await res.json()) as { daily: Record<string, DailyWeather>; hourly: Record<string, HourlySlot[]> }

        if (cancelledRef.current) return

        const result: Cached = {
          weatherByDate: data.daily ?? {},
          hourlyByDate: data.hourly ?? {},
        }

        cache.set(cacheKey, result)
        setWeatherByDate(result.weatherByDate)
        setHourlyByDate(result.hourlyByDate)
      } catch {
        if (!cancelledRef.current) setError(true)
      } finally {
        if (!cancelledRef.current) setLoading(false)
      }
    }

    load()

    return () => {
      cancelledRef.current = true
    }
  }, [trip.destination, trip.start_date, trip.end_date])

  return { weatherByDate, hourlyByDate, loading, error }
}
