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
      prompt = `You are a travel planner for a trip to ${body.trip?.destination}.
Trip: ${body.trip?.name}, ${body.trip?.start_date} to ${body.trip?.end_date}.
${body.day ? `Focus on: ${body.day}` : "Suggest for the whole trip."}

Suggest 6 activities. Return ONLY a valid JSON array, no markdown:
[{"title":"Name","category":"Activities","location":"Place, City","notes":"Tip","duration":"2 hours"}]`

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
      max_tokens: 800,
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content ?? ""

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
    console.error("[tripletto-ai] error:", err)
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 })
  }
}
