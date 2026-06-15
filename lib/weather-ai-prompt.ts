import type { Activity, Trip } from "@/lib/types"
import type { DailyWeather } from "@/app/api/weather/route"
import { wmoToDisplay } from "@/lib/weather-utils"
import { daysBetween } from "@/lib/dates"

export type WeatherSuggestion = {
  type: "warning" | "tip" | "reorder"
  icon: string
  title: string
  body: string
  dayDate: string
}

const SYSTEM = `You are a smart travel assistant for a group trip planner called Tripletto. \
You have access to the trip itinerary and weather forecast. Give concise, practical, friendly suggestions. \
Max 3 suggestions. Each suggestion must be actionable. Never repeat the same suggestion twice. \
Respond only in JSON — no markdown fences, no explanation, just the raw JSON array.`

export function buildWeatherPrompt(
  trip: Trip,
  activities: Activity[],
  weatherByDate: Record<string, DailyWeather>,
): { system: string; user: string } {
  const days = daysBetween(trip.start_date, trip.end_date)

  const weatherLines = days
    .map((date) => {
      const w = weatherByDate[date]
      if (!w) return null
      const { icon } = wmoToDisplay(w.code)
      const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })
      return `- ${date} (${label}): ${icon} ${w.max}°C, ${w.rainChance}% rain, ${w.windspeedMax} km/h wind`
    })
    .filter(Boolean)
    .join("\n")

  const activityLines = days
    .map((date) => {
      const dayActs = activities.filter(
        (a) => a.day_date === date && !a.is_wishlist && !a.is_kiv,
      )
      if (dayActs.length === 0) return null
      const actStr = dayActs
        .map((a) => `${a.start_time ? a.start_time.slice(0, 5) + " " : ""}${a.title} (${a.category})`)
        .join(", ")
      return `- ${date}: ${actStr}`
    })
    .filter(Boolean)
    .join("\n")

  const user = `Here is the trip itinerary and weather forecast:

Trip: ${trip.name}, ${trip.destination ?? ""}
Dates: ${trip.start_date} to ${trip.end_date}

Weather forecast:
${weatherLines || "(no weather data available)"}

Activities by day:
${activityLines || "(no activities planned yet)"}

Generate exactly 3 weather-aware suggestions as a JSON array:
[
  {
    "type": "warning" | "tip" | "reorder",
    "icon": "🌧" | "☀️" | "🔄" | "⚠️" | "👜" | "🕐",
    "title": "<max 8 words>",
    "body": "<max 20 words>",
    "dayDate": "<YYYY-MM-DD — the day this suggestion applies to>"
  }
]

Focus on:
- Days with outdoor activities AND rain > 50% (warn and suggest indoor alternatives)
- Back-to-back outdoor activities on hot days (>33°C)
- Best-weather days with light schedules (suggest filling them)
- Packing reminders based on the weather pattern across all days
- Departure time suggestions when weather + crowd patterns matter`

  return { system: SYSTEM, user }
}
