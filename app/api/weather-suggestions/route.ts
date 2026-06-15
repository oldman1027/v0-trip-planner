import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createServiceClient } from "@/lib/supabase/server"
import { buildWeatherPrompt, type WeatherSuggestion } from "@/lib/weather-ai-prompt"
import type { Activity, Trip } from "@/lib/types"
import type { DailyWeather } from "@/app/api/weather/route"

const CACHE_HOURS = 6

export async function POST(req: NextRequest) {
  try {
    const { tripId, trip, activities, weatherByDate, force = false } = (await req.json()) as {
      tripId: string
      trip: Trip
      activities: Activity[]
      weatherByDate: Record<string, DailyWeather>
      force?: boolean
    }

    if (!tripId) return NextResponse.json({ suggestions: [] })

    const supabase = await createServiceClient()

    // Return cached suggestions if fresh enough (unless forced refresh)
    if (!force) {
      const { data: cached } = await supabase
        .from("weather_suggestions")
        .select("suggestions, generated_at")
        .eq("trip_id", tripId)
        .single()

      if (cached) {
        const ageMs = Date.now() - new Date(cached.generated_at as string).getTime()
        if (ageMs < CACHE_HOURS * 60 * 60 * 1000) {
          return NextResponse.json({
            suggestions: cached.suggestions as WeatherSuggestion[],
            cached: true,
            generatedAt: cached.generated_at,
          })
        }
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ suggestions: [] })

    const { system, user } = buildWeatherPrompt(trip, activities, weatherByDate)

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "[]"
    let suggestions: WeatherSuggestion[] = []
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const parsed = JSON.parse(cleaned)
      suggestions = Array.isArray(parsed) ? (parsed as WeatherSuggestion[]) : []
    } catch {
      suggestions = []
    }

    const generatedAt = new Date().toISOString()
    await supabase
      .from("weather_suggestions")
      .upsert({ trip_id: tripId, suggestions, generated_at: generatedAt }, { onConflict: "trip_id" })

    return NextResponse.json({ suggestions, cached: false, generatedAt })
  } catch (err) {
    console.error("[weather-suggestions]", err)
    return NextResponse.json({ suggestions: [] })
  }
}
