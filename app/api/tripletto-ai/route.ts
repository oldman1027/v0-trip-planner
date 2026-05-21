import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

async function callModel(apiKey: string, model: string, prompt: string) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://v0-tripletto.vercel.app",
      "X-Title": "Tripletto",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  })
}

export async function POST(request: NextRequest) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

  console.log("[tripletto-ai] called, key present:", !!OPENROUTER_API_KEY,
    "key length:", OPENROUTER_API_KEY?.length)

  if (!OPENROUTER_API_KEY) {
    console.error("[tripletto-ai] OPENROUTER_API_KEY missing")
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    console.log("[tripletto-ai] mode:", body.mode)

    let prompt = ""
    if (body.mode === "suggest") {
      prompt = `You are a travel planner AI for a trip to ${body.trip?.destination || "the destination"}.
Trip: ${body.trip?.name}, dates: ${body.trip?.start_date} to ${body.trip?.end_date}.
${body.day ? `Focus on: ${body.day}` : "Suggest activities for the whole trip."}

Suggest 6 travel activities. Return ONLY valid JSON array, no markdown, no explanation:
[{"title":"Activity name","category":"Activities","location":"Place name, City","notes":"Brief tip","duration":"2 hours"}]`

    } else if (body.mode === "chat") {
      prompt = `You are Tripletto AI, a friendly travel planning assistant.
Trip: ${body.trip?.name} to ${body.trip?.destination}, ${body.trip?.start_date} to ${body.trip?.end_date}.

User asks: ${body.message}

Format your response to be SCANNABLE and ORGANIZED:
- Start with one short intro sentence
- Use 2-4 short sections with bold headers (e.g. **Getting Around**)
- Under each header, use bullet points (- ) for specific suggestions
- Keep each bullet to one line
- End with one brief practical tip
- Total response under 200 words
- Do NOT write long paragraphs`
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    console.log("[tripletto-ai] calling primary model...")
    let response = await callModel(OPENROUTER_API_KEY, "z-ai/glm-4.5-air:free", prompt)

    if (!response.ok) {
      console.warn("[tripletto-ai] primary model failed, falling back to openrouter/free")
      response = await callModel(OPENROUTER_API_KEY, "openrouter/free", prompt)
    }

    console.log("[tripletto-ai] OpenRouter status:", response.status)

    if (!response.ok) {
      const errText = await response.text()
      console.error("[tripletto-ai] OpenRouter error:", errText)
      return NextResponse.json(
        { error: `OpenRouter error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    console.log("[tripletto-ai] got response, model used:", data.model)
    const text = data.choices?.[0]?.message?.content ?? ""

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
    return NextResponse.json(
      { error: `Failed: ${message}` },
      { status: 500 }
    )
  }
}
