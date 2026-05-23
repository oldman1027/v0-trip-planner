import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 30

type DayCtx = {
  day: number
  date: string
  dateLabel: string
  activities: { title: string; location: string | null; time: string | null; category: string }[]
}

type TripInfo = { name?: string; destination?: string; start_date?: string; end_date?: string }

function buildDayBreakdown(dayContext: DayCtx[]): string {
  if (!dayContext.length) return "No itinerary data available."
  return dayContext
    .map((d) => {
      const acts =
        d.activities.length > 0
          ? d.activities
              .map((a) => `${a.title}${a.location ? ` @ ${a.location}` : ""}${a.time ? ` (${a.time.slice(0, 5)})` : ""}`)
              .join(", ")
          : "nothing planned yet"
      return `Day ${d.day} – ${d.dateLabel}: ${acts}`
    })
    .join("\n")
}

function buildChatPrompt(trip: TripInfo, activityCount: number, message: string, dayContext: DayCtx[]): string {
  return `You are Tripletto AI, a smart travel assistant with full knowledge of this specific trip.

TRIP: ${trip.name ?? "Unnamed trip"} to ${trip.destination ?? "unknown destination"}
DATES: ${trip.start_date} to ${trip.end_date}
ACTIVITIES PLANNED: ${activityCount}

CURRENT ITINERARY BY DAY:
${buildDayBreakdown(dayContext)}

INSTRUCTIONS:
- When the user says "Day 2", "Day 3" etc → look up that day above to know the date and location
- Infer their location from the activities already planned for that day
- Recommend places NEAR their planned activities (not the trip's main city if they're elsewhere)
- Use real place names, neighborhoods, distances — be specific
- If a day has activities in a specific city/area, give recommendations there

USER MESSAGE: ${message}

Reply in a structured, scannable format:
- One sentence acknowledging their context (day and location if known)
- 3-4 specific recommendations with names and locations
- One practical tip
- Under 200 words`
}

function buildSuggestPrompt(trip: TripInfo, dayContext: DayCtx[], day: string | null): string {
  const start = trip.start_date ?? "the start date"
  const end   = trip.end_date   ?? "the end date"

  const focusLine = day
    ? `Focus on: ${day}`
    : "Spread activities across all dates, filling gaps in the existing itinerary."

  const breakdown = buildDayBreakdown(dayContext)

  return `You are a travel planner for a trip to ${trip.destination ?? "the destination"}.
Trip: ${trip.name}, ${start} to ${end}.

CURRENT ITINERARY:
${breakdown}

${focusLine}

Suggest 6 NEW activities that complement the existing itinerary. Do not duplicate existing activities.
For each day that already has activities in a specific city/area, suggest activities in the same area.

Return ONLY a valid JSON array — no markdown, no explanation:
[{"title":"Example Activity","category":"attraction","location":"Place, City","notes":"Helpful tip","time_block":"afternoon","day_date":"${start}","start_time":null,"end_time":null,"cost_amount":null}]

Rules:
- category: food | attraction | transport | accommodation | shopping | entertainment | other
- time_block: morning | afternoon | night
- day_date: YYYY-MM-DD, spread across ${start} to ${end}
- Return ONLY the JSON array, no markdown code blocks`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[tripletto-ai] OPENAI_API_KEY missing")
    return NextResponse.json({ error: "AI not configured" }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  try {
    const body = await request.json()
    const { mode, trip, activities, message, dayContext = [], day = null } = body as {
      mode: string
      trip: TripInfo
      activities: unknown[]
      message: string
      dayContext: DayCtx[]
      day: string | null
    }

    let prompt = ""
    if (mode === "suggest") {
      prompt = buildSuggestPrompt(trip, dayContext, day)
    } else if (mode === "chat") {
      prompt = buildChatPrompt(trip, activities.length, message, dayContext)
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: mode === "suggest" ? 1200 : 800,
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content ?? ""

    if (mode === "suggest") {
      console.log("[tripletto-ai] suggest raw:", text.substring(0, 300))
      let suggestions: unknown[] = []
      try {
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        try {
          suggestions = JSON.parse(cleaned)
        } catch {
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
          if (jsonMatch) suggestions = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error("[tripletto-ai] JSON parse error:", e, "text:", text)
        return NextResponse.json({ type: "message", content: text })
      }
      const summary = dayContext.length > 0
        ? `Here are activity ideas that fit your ${trip.destination ?? "trip"} itinerary:`
        : `Here are some activity ideas for your trip to ${trip.destination ?? "your destination"}:`
      return NextResponse.json({ type: "suggestions", suggestions, summary })
    } else {
      return NextResponse.json({ type: "message", content: text })
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[tripletto-ai] error:", err)
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 })
  }
}
