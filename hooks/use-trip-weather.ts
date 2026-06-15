"use client"

import { useState, useEffect, useRef } from "react"
import { geocodeDestination } from "@/lib/weather"
import { daysBetween } from "@/lib/dates"
import type { DailyWeather, HourlySlot } from "@/app/api/weather/route"
import type { Activity } from "@/lib/types"

export type { DailyWeather, HourlySlot }

type TripLike = {
  id: string
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

const memCache = new Map<string, Cached>()

function getCached(key: string): Cached | null {
  const mem = memCache.get(key)
  if (mem) return mem
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Cached
      memCache.set(key, parsed)
      return parsed
    }
  } catch {}
  return null
}

function setCached(key: string, value: Cached) {
  memCache.set(key, value)
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function cityFromLocation(location: string | null | undefined): string | null {
  if (!location) return null
  return location.split(",")[0]?.trim() || null
}

export function useTripWeather(trip: TripLike, activities?: Activity[]): WeatherResult {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DailyWeather>>({})
  const [hourlyByDate, setHourlyByDate] = useState<Record<string, HourlySlot[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const cancelledRef = useRef(false)
  // Snapshot activities once — weather fetches only once per session per trip
  const activitiesRef = useRef(activities)

  useEffect(() => {
    cancelledRef.current = false
    const cacheKey = `weather_${trip.id}`

    const cached = getCached(cacheKey)
    if (cached) {
      setWeatherByDate(cached.weatherByDate)
      setHourlyByDate(cached.hourlyByDate)
      return
    }

    setLoading(true)
    setError(false)

    async function load() {
      try {
        const acts = activitiesRef.current ?? []
        const days = daysBetween(trip.start_date, trip.end_date)

        // Build date → dominant city map from activity locations
        const dateCityMap = new Map<string, string>()
        if (acts.length > 0) {
          const dayCounts = new Map<string, Map<string, number>>()
          for (const a of acts) {
            if (!a.day_date) continue
            const city = cityFromLocation(a.location)
            if (!city) continue
            const m = dayCounts.get(a.day_date) ?? new Map<string, number>()
            m.set(city, (m.get(city) ?? 0) + 1)
            dayCounts.set(a.day_date, m)
          }
          for (const [date, counts] of dayCounts) {
            const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
            if (top) dateCityMap.set(date, top[0])
          }
        }

        // Each day gets its detected city, falling back to trip.destination
        const dayCityList = days.map((d) => ({
          date: d,
          city: dateCityMap.get(d) ?? trip.destination ?? null,
        }))

        // Geocode unique cities in parallel
        const uniqueCities = [
          ...new Set(dayCityList.map((d) => d.city).filter(Boolean) as string[]),
        ]
        const coordMap = new Map<string, { lat: number; lon: number }>()
        await Promise.all(
          uniqueCities.map(async (city) => {
            const coords = await geocodeDestination(city)
            if (coords) coordMap.set(city, { lat: coords.latitude, lon: coords.longitude })
          }),
        )

        if (cancelledRef.current) return

        // Group dates by unique lat/lon to batch API calls
        const coordGroups = new Map<string, { lat: number; lon: number; dates: string[] }>()
        for (const { date, city } of dayCityList) {
          if (!city) continue
          const coords = coordMap.get(city)
          if (!coords) continue
          const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`
          if (!coordGroups.has(key)) coordGroups.set(key, { ...coords, dates: [] })
          coordGroups.get(key)!.dates.push(date)
        }

        if (coordGroups.size === 0) return

        // Fetch weather per unique location, only for its own date range
        const allDaily: Record<string, DailyWeather> = {}
        const allHourly: Record<string, HourlySlot[]> = {}

        await Promise.all(
          [...coordGroups.values()].map(async ({ lat, lon, dates }) => {
            const sorted = dates.slice().sort()
            const params = new URLSearchParams({
              lat: String(lat),
              lng: String(lon),
              start_date: sorted[0]!,
              end_date: sorted[sorted.length - 1]!,
            })
            const res = await fetch(`/api/weather?${params}`)
            if (!res.ok) return
            const data = (await res.json()) as {
              daily: Record<string, DailyWeather>
              hourly: Record<string, HourlySlot[]>
            }
            const dateSet = new Set(dates)
            for (const [d, w] of Object.entries(data.daily ?? {})) {
              if (dateSet.has(d)) allDaily[d] = w
            }
            for (const [d, slots] of Object.entries(data.hourly ?? {})) {
              if (dateSet.has(d)) allHourly[d] = slots
            }
          }),
        )

        if (cancelledRef.current) return

        const result: Cached = { weatherByDate: allDaily, hourlyByDate: allHourly }
        setCached(cacheKey, result)
        setWeatherByDate(allDaily)
        setHourlyByDate(allHourly)
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
    // activities intentionally excluded — snapshot via ref, fetches only once per session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, trip.start_date, trip.end_date])

  return { weatherByDate, hourlyByDate, loading, error }
}
