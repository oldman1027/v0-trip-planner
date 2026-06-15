"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Activity, Trip } from "@/lib/types"
import type { DailyWeather } from "@/app/api/weather/route"
import type { WeatherSuggestion } from "@/lib/weather-ai-prompt"

export type { WeatherSuggestion }

export function useWeatherSuggestions(
  trip: Trip,
  activities: Activity[],
  weatherByDate: Record<string, DailyWeather>,
) {
  const [suggestions, setSuggestions] = useState<WeatherSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  // Stable refs so the fetch function doesn't need to be recreated
  const tripRef = useRef(trip)
  const activitiesRef = useRef(activities)
  const weatherRef = useRef(weatherByDate)
  useEffect(() => { tripRef.current = trip }, [trip])
  useEffect(() => { activitiesRef.current = activities }, [activities])
  useEffect(() => { weatherRef.current = weatherByDate }, [weatherByDate])

  const fetchSuggestions = useCallback(async (force = false) => {
    const weather = weatherRef.current
    if (fetchingRef.current) return
    if (Object.keys(weather).length === 0) return

    fetchingRef.current = true
    setIsLoading(true)
    try {
      const t = tripRef.current
      const acts = activitiesRef.current
      const res = await fetch("/api/weather-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: t.id,
          trip: t,
          activities: acts.filter((a) => !a.is_wishlist && !a.is_kiv),
          weatherByDate: weather,
          force,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { suggestions: WeatherSuggestion[]; generatedAt?: string }
      setSuggestions(data.suggestions ?? [])
      setGeneratedAt(data.generatedAt ?? null)
    } catch {
      // silently fail — weather suggestions are non-critical
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, []) // stable — reads from refs

  // Auto-fetch once when weather data first becomes available
  const hasWeather = Object.keys(weatherByDate).length > 0

  useEffect(() => {
    if (!hasWeather) return
    fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, hasWeather]) // fetchSuggestions is stable

  const refresh = useCallback(() => fetchSuggestions(true), [fetchSuggestions])

  return { suggestions, isLoading, generatedAt, refresh }
}
