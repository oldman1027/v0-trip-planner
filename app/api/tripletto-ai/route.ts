import { NextRequest, NextResponse } from "next/server"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODELS = [
  "google/gemini-2.5-flash-preview:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free",
]

async function callOpenRouter(prompt: string): Promise<string> {
  for (const model of MODELS) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://v0-tripletto.vercel.app",
        "X-Title": "Tripletto",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (response.ok) {
      const data = await response.json()
      return data.choices?.[0]?.message?.content ?? ""
    }
    const err = await response.text()
    console.warn(`[tripletto-ai] model ${model} failed:`, err)
  }
  throw new Error("All models failed")
}

export async function POST(request: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    console.error("[tripletto-ai] OPENROUTER_API_KEY not set")
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()

    let prompt = ""
    if (body.mode === "suggest") {
      prompt = buildSuggestPrompt(body.trip, body.activities, body.day)
    } else if (body.mode === "chat") {
      prompt = buildChatPrompt(body.trip, body.activities, body.message)
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const text = await callOpenRouter(prompt)

    if (body.mode === "suggest") {
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        const activities = jsonMatch ? JSON.parse(jsonMatch[0]) : []
        return NextResponse.json({ type: "suggestions", activities })
      } catch {
        return NextResponse.json({ type: "message", content: text })
      }
    } else {
      return NextResponse.json({ type: "message", content: text })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[tripletto-ai] unhandled error:", err)
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSuggestPrompt(trip: any, activities: any[], day: string | null) {
  return `You are a travel planner AI for a trip to ${trip?.destination || "unknown destination"}.
Trip dates: ${trip?.start_date} to ${trip?.end_date}.
Existing activities: ${JSON.stringify(activities?.slice(0, 10) || [])}.
${day ? `Focus on day: ${day}` : "Suggest activities across the whole trip."}

Suggest 5-8 travel activities. Return ONLY a JSON array with no other text:
[
  {
    "title": "Activity name",
    "category": "Activities|Dining|Transport|Accommodation|Shopping|Entertainment|Other",
    "location": "Full address or place name",
    "notes": "Brief description and tips",
    "duration": "2 hours"
  }
]`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildChatPrompt(trip: any, activities: any[], message: string) {
  return `You are Tripletto AI, a helpful travel planning assistant.
Trip: ${trip?.name} to ${trip?.destination}.
Dates: ${trip?.start_date} to ${trip?.end_date}.
Current activities planned: ${JSON.stringify(activities?.slice(0, 10) || [])}.

User question: ${message}

Give a helpful, concise travel advice response in 2-3 paragraphs.`
}
