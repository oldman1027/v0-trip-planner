import { NextRequest, NextResponse } from "next/server"

export type DailyWeather = {
  max: number
  min: number
  rainChance: number
  code: number
}

export type HourlySlot = {
  hour: number
  temp: number
  rainChance: number
  code: number
}

export type WeatherResponse = {
  daily: Record<string, DailyWeather>
  hourly: Record<string, HourlySlot[]>
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 })
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}&timezone=auto` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
    `&hourly=temperature_2m,precipitation_probability,weathercode` +
    `&temperature_unit=celsius&forecast_days=16`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 })

    const data = (await res.json()) as {
      daily: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: number[]
        weathercode: number[]
      }
      hourly: {
        time: string[]
        temperature_2m: number[]
        precipitation_probability: number[]
        weathercode: number[]
      }
    }

    const daily: Record<string, DailyWeather> = {}
    for (let i = 0; i < data.daily.time.length; i++) {
      const date = data.daily.time[i]
      if (startDate && date < startDate) continue
      if (endDate && date > endDate) continue
      daily[date] = {
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
        rainChance: data.daily.precipitation_probability_max[i] ?? 0,
        code: data.daily.weathercode[i],
      }
    }

    const hourly: Record<string, HourlySlot[]> = {}
    for (let i = 0; i < data.hourly.time.length; i++) {
      const parts = data.hourly.time[i].split("T")
      const dateStr = parts[0]
      const hour = parseInt(parts[1]?.split(":")[0] ?? "0", 10)
      if (startDate && dateStr < startDate) continue
      if (endDate && dateStr > endDate) continue
      if (!hourly[dateStr]) hourly[dateStr] = []
      hourly[dateStr].push({
        hour,
        temp: Math.round(data.hourly.temperature_2m[i]),
        rainChance: data.hourly.precipitation_probability[i] ?? 0,
        code: data.hourly.weathercode[i],
      })
    }

    const response = NextResponse.json({ daily, hourly } satisfies WeatherResponse)
    response.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=600")
    return response
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 })
  }
}
