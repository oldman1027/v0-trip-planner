import { NextRequest } from "next/server"
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
  const dayMentionMatch = message.match(/day\s*(\d+)/i)
  const mentionedDayNum = dayMentionMatch ? parseInt(dayMentionMatch[1]) : null
  const mentionedDay = mentionedDayNum ? dayContext.find((d) => d.day === mentionedDayNum) : null

  const dayLocation =
    mentionedDay && mentionedDay.activities.length > 0
      ? mentionedDay.activities[0].location?.split(",").slice(-2).join(",").trim() ?? trip.destination
      : trip.destination

  const contextIntro = mentionedDay
    ? `User is asking about Day ${mentionedDayNum} (${mentionedDay.dateLabel}) — their activities that day are in: ${dayLocation}`
    : `General trip question about ${trip.destination ?? "the destination"}`

  const isFoodRequest = /restaurant|eat|food|dining|cafe|lunch|dinner|breakfast|snack|market|street food/i.test(message)
  const isAccomRequest = /hotel|hostel|stay|accommodation|sleep|where to stay/i.test(message)
  const requestType = isFoodRequest
    ? "FOOD & DINING — suggest only restaurants, cafes, food markets, street food"
    : isAccomRequest
      ? "ACCOMMODATION — suggest only hotels, hostels, guesthouses"
      : "GENERAL ACTIVITIES — suggest sightseeing, experiences, tours, things to do"

  // Build explicit day→city map so the model never confuses locations
  const dayLocationMap = dayContext.reduce<Record<string, string>>((acc, d) => {
    if (d.activities.length > 0) {
      const cities = d.activities
        .map((a) => a.location?.split(",").slice(-2, -1)[0]?.trim())
        .filter((x): x is string => !!x)
      if (cities.length > 0) acc[`Day ${d.day}`] = cities[0]
    }
    return acc
  }, {})
  const locationContext = Object.entries(dayLocationMap)
    .map(([d, city]) => `${d} = ${city}`)
    .join(", ") || "No activities planned yet"

  console.log("[tripletto-ai] chat dayContext days:", dayContext.length, "locationMap:", locationContext)

  return `You are Tripletto AI, a smart travel assistant with full knowledge of this specific trip.

TRIP: ${trip.name ?? "Unnamed trip"} to ${trip.destination ?? "unknown destination"}
DATES: ${trip.start_date} to ${trip.end_date}
ACTIVITIES PLANNED: ${activityCount}

DAY → CITY MAP (ground truth — never mix these up):
${locationContext}

CURRENT ITINERARY BY DAY:
${buildDayBreakdown(dayContext)}

USER REQUEST ANALYSIS:
Context: ${contextIntro}
User asked: "${message}"
Request type: ${requestType}
Specific day: ${mentionedDay ? `Day ${mentionedDayNum} (${mentionedDay.dateLabel}) in ${dayLocation}` : "Not specified"}

STRICT RULES:
- If request type is FOOD & DINING → ONLY suggest restaurants, cafes, food markets — no sightseeing
- If request type is ACCOMMODATION → ONLY suggest hotels, hostels, guesthouses
- If request type is GENERAL ACTIVITIES → ONLY suggest sightseeing, tours, experiences — no restaurants
- All suggestions must be near: ${dayLocation ?? trip.destination ?? "the destination"}
- Use real place names, neighborhoods, distances — be specific

Reply in a structured, scannable format:
- One sentence acknowledging their context (day and location if known)
- 3-4 specific recommendations with names and locations
- One practical tip
- Under 200 words`
}

function buildSuggestPrompt(trip: TripInfo, dayContext: DayCtx[], day: string | null): string {
  const start = trip.start_date ?? "the start date"
  const end   = trip.end_date   ?? "the end date"

  // Build explicit per-day location map so the model knows exactly which city each day is in
  const daySummaryLines = dayContext.map((d) => {
    const locations = [
      ...new Set(
        d.activities
          .map((a) => a.location?.split(",").slice(-2).join(",").trim())
          .filter((x): x is string => !!x),
      ),
    ]
    const existingTitles = d.activities.map((a) => a.title)
    const locationStr = locations.length > 0 ? locations.join(", ") : (trip.destination ?? "unknown")
    const existingStr = existingTitles.length > 0 ? existingTitles.join(", ") : "nothing planned yet"
    return `Day ${d.day} | ${d.date} | ${d.dateLabel} | CITY: ${locationStr} | Already planned: ${existingStr}`
  })

  console.log("[tripletto-ai] suggest dayContext:", dayContext.length, "day1:", JSON.stringify(dayContext[0]))

  const focusLine = day
    ? `FOCUS: Only suggest activities for: ${day}`
    : "Spread suggestions across days that need more activities."

  return `You are a travel planner. Suggest 6 NEW activities for this specific trip.

TRIP: ${trip.name ?? "Unnamed trip"} to ${trip.destination ?? "the destination"}
DATES: ${start} to ${end}

DAY-BY-DAY LOCATION MAP — THIS IS THE GROUND TRUTH FOR WHICH CITY EACH DAY IS IN:
${daySummaryLines.join("\n")}

${focusLine}

CRITICAL RULES — VIOLATIONS WILL BREAK THE APP:
1. CITY MATCHING: Each suggestion MUST be in the same city as the "CITY:" field for that day
   - If Day 2 CITY says "Pattaya" → Day 2 suggestions MUST be in Pattaya, NOT Bangkok
   - If Day 1 CITY says "Bangkok" → Day 1 suggestions MUST be in Bangkok, NOT Pattaya
2. NO DUPLICATES: Do not suggest anything already listed in "Already planned"
3. EXACT DATES: The day_date field MUST be the exact date shown in the DAY-BY-DAY map (YYYY-MM-DD)

Return ONLY a valid JSON array — no markdown, no explanation, no code blocks:
[{"title":"Activity Name","category":"attraction","location":"Specific Place, City","notes":"One helpful tip","time_block":"afternoon","day_date":"YYYY-MM-DD","start_time":null,"end_time":null,"cost_amount":null}]

Schema rules:
- category: food | attraction | transport | accommodation | shopping | entertainment | other
- time_block: morning | afternoon | night
- day_date: exact YYYY-MM-DD from the DAY-BY-DAY LOCATION MAP above — never invent a date`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[tripletto-ai] OPENAI_API_KEY missing")
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 })
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

    if (mode === "suggest") {
      const prompt = buildSuggestPrompt(trip, dayContext, day)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
      })
      const text = completion.choices[0]?.message?.content ?? ""
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
        console.error("[tripletto-ai] JSON parse error:", e)
        return new Response(JSON.stringify({ type: "message", content: text }), {
          headers: { "Content-Type": "application/json" },
        })
      }
      const summary = dayContext.length > 0
        ? `Here are activity ideas that fit your ${trip.destination ?? "trip"} itinerary:`
        : `Here are some activity ideas for your trip to ${trip.destination ?? "your destination"}:`
      return new Response(JSON.stringify({ type: "suggestions", suggestions, summary }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (mode === "chat") {
      const prompt = buildChatPrompt(trip, activities.length, message, dayContext)
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
        stream: true,
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? ""
              if (text) controller.enqueue(encoder.encode(text))
            }
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[tripletto-ai] error:", err)
    return new Response(JSON.stringify({ error: `Failed: ${msg}` }), { status: 500 })
  }
}
