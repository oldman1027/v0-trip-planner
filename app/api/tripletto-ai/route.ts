import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[tripletto-ai] OPENAI_API_KEY missing")
    return NextResponse.json({ error: "AI not configured" }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  try {
    const body = await request.json()

    let prompt = ""
    if (body.mode === "suggest") {
      const start = body.trip?.start_date ?? "the start date"
      const end = body.trip?.end_date ?? "the end date"
      prompt = `You are a travel planner for a trip to ${body.trip?.destination}.
Trip: ${body.trip?.name}, ${start} to ${end}.
${body.day ? `Focus on: ${body.day}` : "Spread activities evenly across all trip dates."}

Suggest 6 activities. Return ONLY a valid JSON array with no markdown, no explanation, nothing else:
[{"title":"Example Activity","category":"attraction","location":"Place, City","notes":"Helpful tip","time_block":"afternoon","day_date":"${start}","start_time":null,"end_time":null,"cost_amount":null}]

Rules:
- category must be one of: food, attraction, transport, accommodation, shopping, entertainment, other
- time_block must be one of: morning, afternoon, night
- day_date must be YYYY-MM-DD format, spread across ${start} to ${end}
- Return ONLY the JSON array, no markdown code blocks`

    } else if (body.mode === "chat") {
      prompt = `You are Tripletto AI, a friendly travel assistant.
Trip: ${body.trip?.name} to ${body.trip?.destination}, ${body.trip?.start_date} to ${body.trip?.end_date}.

User asks: ${body.message}

Reply in a structured, scannable format:
- One short intro sentence
- 2-3 sections with **bold headers**
- Bullet points under each header
- Keep bullets to one line each
- End with one practical tip
- Under 200 words total`
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: body.mode === "suggest" ? 1200 : 800,
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content ?? ""

    if (body.mode === "suggest") {
      console.log("[tripletto-ai] suggest raw text:", text.substring(0, 300))
      let suggestions: unknown[] = []
      try {
        // Strip markdown code blocks if GPT wraps the JSON
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        try {
          suggestions = JSON.parse(cleaned)
        } catch {
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
          if (jsonMatch) suggestions = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error("[tripletto-ai] JSON parse error:", e, "text was:", text)
        return NextResponse.json({ type: "message", content: text })
      }
      return NextResponse.json({ type: "suggestions", suggestions })
    } else {
      return NextResponse.json({ type: "message", content: text })
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[tripletto-ai] error:", err)
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 })
  }
}
