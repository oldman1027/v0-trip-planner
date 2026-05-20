import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"
import type { Activity, Trip } from "@/lib/types"

// Intentionally deferred to request time so missing key produces a clear log

type SuggestPayload = {
  mode: "suggest"
  trip: Trip
  activities: Activity[]
  day: string | null
  message: string
}

type ChatPayload = {
  mode: "chat"
  trip: Trip
  activities: Activity[]
  message: string
}

function buildSuggestPrompt(trip: Trip, activities: Activity[], day: string | null, message: string) {
  const existingTitles = activities.map((a) => a.title).join(", ")
  const dayInfo = day ? `Focus on ${day}.` : `Spread across all trip days from ${trip.start_date} to ${trip.end_date}.`

  return `You are a smart travel planner for a trip called "${trip.name}" to ${trip.destination ?? "an unspecified destination"}.
Trip dates: ${trip.start_date} to ${trip.end_date}.
Existing activities: ${existingTitles || "none yet"}.

User request: "${message}"
${dayInfo}

Return a JSON object with this exact structure (no markdown, no code fences, raw JSON only):
{
  "summary": "One sentence describing what you're suggesting",
  "suggestions": [
    {
      "title": "Activity name",
      "category": "food|attraction|transport|accommodation|shopping|entertainment|other",
      "location": "Full address or place name",
      "time_block": "morning|afternoon|night",
      "start_time": "HH:MM or null",
      "end_time": "HH:MM or null",
      "notes": "Tip or detail, or null",
      "cost_amount": 0,
      "day_date": "YYYY-MM-DD"
    }
  ]
}

Suggest 3–6 varied activities. Use real places. Avoid duplicating existing activities.`
}

function buildChatPrompt(trip: Trip, activities: Activity[], message: string) {
  const itinerary = activities
    .filter((a) => !a.is_wishlist && a.day_date)
    .sort((a, b) => (a.day_date ?? "").localeCompare(b.day_date ?? ""))
    .map((a) => `- ${a.day_date} ${a.time_block}: ${a.title}${a.location ? ` @ ${a.location}` : ""}`)
    .join("\n")

  return `You are Tripletto, a helpful travel assistant for the trip "${trip.name}" to ${trip.destination ?? "an unspecified destination"} (${trip.start_date} to ${trip.end_date}).

Current itinerary:
${itinerary || "No activities planned yet."}

Answer the user's question concisely and helpfully. Include practical tips, nearby suggestions, or logistics as relevant.

User: ${message}`
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error("No valid JSON found in response")
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    console.log("[tripletto-ai] key present:", !!apiKey)
    if (!apiKey) {
      console.error("[tripletto-ai] GOOGLE_AI_API_KEY is not set in environment")
      return NextResponse.json({ error: "AI service is not configured" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)

    const body = (await request.json()) as SuggestPayload | ChatPayload

    if (body.mode !== "suggest" && body.mode !== "chat") {
      return NextResponse.json({ error: "Invalid mode — expected 'suggest' or 'chat'" }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    if (body.mode === "suggest") {
      const prompt = buildSuggestPrompt(body.trip, body.activities, body.day, body.message)
      const result = await model.generateContent(prompt)
      const text = result.response.text()

      let parsed: { summary: string; suggestions: unknown[] }
      try {
        parsed = extractJson(text) as { summary: string; suggestions: unknown[] }
      } catch (parseErr) {
        console.error("[tripletto-ai] JSON parse failed:", parseErr, "\nRaw text:", text)
        return NextResponse.json({ error: "AI returned malformed JSON" }, { status: 500 })
      }

      return NextResponse.json({
        type: "suggestions",
        summary: parsed.summary,
        suggestions: parsed.suggestions,
      })
    }

    if (body.mode === "chat") {
      const prompt = buildChatPrompt(body.trip, body.activities, body.message)
      const result = await model.generateContent(prompt)
      return NextResponse.json({ type: "message", content: result.response.text() })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[tripletto-ai] unhandled error:", err)
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 500 })
  }
}
