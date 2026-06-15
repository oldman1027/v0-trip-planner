import { NextRequest, NextResponse } from "next/server"
import { getWeatherStrategy } from "@/lib/weather-utils"

export type DailyWeather = {
  max: number
  min: number
  rainChance: number
  code: number
  windspeedMax: number
  source?: "forecast" | "historical"
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

type OMDaily = {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  windspeed_10m_max: number[]
  weathercode: number[]
  precipitation_probability_max?: number[]
  precipitation_sum?: number[]
}

type OMHourly = {
  time: string[]
  temperature_2m: number[]
  weathercode: number[]
  precipitation_probability?: number[]
  precipitation?: number[]
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function precipSumToRainChance(sumMm: number): number {
  if (sumMm > 10) return 90
  if (sumMm > 5) return 70
  if (sumMm > 1) return 50
  if (sumMm > 0.1) return 20
  return 5
}

async function fetchForecastRaw(
  lat: string,
  lng: string,
  start: string,
  end: string,
): Promise<{ daily: OMDaily; hourly: OMHourly }> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}&timezone=auto` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode` +
    `&hourly=temperature_2m,precipitation_probability,weathercode` +
    `&temperature_unit=celsius&start_date=${start}&end_date=${end}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Forecast API ${res.status}`)
  return res.json() as Promise<{ daily: OMDaily; hourly: OMHourly }>
}

async function fetchArchiveRaw(
  lat: string,
  lng: string,
  start: string,
  end: string,
): Promise<{ daily: OMDaily; hourly: OMHourly }> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lng}&timezone=auto` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode` +
    `&hourly=temperature_2m,precipitation,weathercode` +
    `&temperature_unit=celsius&start_date=${start}&end_date=${end}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Archive API ${res.status}`)
  return res.json() as Promise<{ daily: OMDaily; hourly: OMHourly }>
}

function extractDaily(
  data: OMDaily,
  source: "forecast" | "historical",
  dateOffset: number,
  filterStart: string,
  filterEnd: string,
): Record<string, DailyWeather> {
  const out: Record<string, DailyWeather> = {}
  for (let i = 0; i < data.time.length; i++) {
    const date = dateOffset ? shiftDate(data.time[i]!, dateOffset) : data.time[i]!
    if (date < filterStart || date > filterEnd) continue
    out[date] = {
      max: Math.round(data.temperature_2m_max[i]!),
      min: Math.round(data.temperature_2m_min[i]!),
      rainChance:
        source === "forecast"
          ? (data.precipitation_probability_max?.[i] ?? 0)
          : precipSumToRainChance(data.precipitation_sum?.[i] ?? 0),
      code: data.weathercode[i]!,
      windspeedMax: Math.round(data.windspeed_10m_max[i] ?? 0),
      source,
    }
  }
  return out
}

function extractHourly(
  data: OMHourly,
  source: "forecast" | "historical",
  dateOffset: number,
  filterStart: string,
  filterEnd: string,
): Record<string, HourlySlot[]> {
  const out: Record<string, HourlySlot[]> = {}
  for (let i = 0; i < data.time.length; i++) {
    const parts = data.time[i]!.split("T")
    const date = dateOffset ? shiftDate(parts[0]!, dateOffset) : parts[0]!
    const hour = parseInt(parts[1]?.split(":")[0] ?? "0", 10)
    if (date < filterStart || date > filterEnd) continue
    if (!out[date]) out[date] = []
    out[date]!.push({
      hour,
      temp: Math.round(data.temperature_2m[i]!),
      rainChance: source === "forecast" ? (data.precipitation_probability?.[i] ?? 0) : 0,
      code: data.weathercode[i]!,
    })
  }
  return out
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

  try {
    const daily: Record<string, DailyWeather> = {}
    const hourly: Record<string, HourlySlot[]> = {}

    if (!startDate || !endDate) {
      // No date range — fetch standard 16-day forecast from today
      const todayStr = new Date().toISOString().slice(0, 10)
      const end = shiftDate(todayStr, 15)
      const data = await fetchForecastRaw(lat, lng, todayStr, end)
      Object.assign(daily, extractDaily(data.daily, "forecast", 0, todayStr, end))
      Object.assign(hourly, extractHourly(data.hourly, "forecast", 0, todayStr, end))
    } else {
      const strategy = getWeatherStrategy(startDate, endDate)

      if (strategy === "forecast") {
        const data = await fetchForecastRaw(lat, lng, startDate, endDate)
        Object.assign(daily, extractDaily(data.daily, "forecast", 0, startDate, endDate))
        Object.assign(hourly, extractHourly(data.hourly, "forecast", 0, startDate, endDate))
      } else if (strategy === "historical") {
        const histStart = shiftDate(startDate, -365)
        const histEnd = shiftDate(endDate, -365)
        const data = await fetchArchiveRaw(lat, lng, histStart, histEnd)
        Object.assign(daily, extractDaily(data.daily, "historical", 365, startDate, endDate))
        Object.assign(hourly, extractHourly(data.hourly, "historical", 365, startDate, endDate))
      } else {
        // blend: forecast for near dates, historical for far dates
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const cutoffDate = new Date(today)
        cutoffDate.setDate(cutoffDate.getDate() + 16)
        const cutoff = cutoffDate.toISOString().slice(0, 10)

        // Forecast part: startDate → cutoff
        const forecastEnd = cutoff < endDate ? cutoff : endDate
        const forecastData = await fetchForecastRaw(lat, lng, startDate, forecastEnd)
        Object.assign(daily, extractDaily(forecastData.daily, "forecast", 0, startDate, forecastEnd))
        Object.assign(hourly, extractHourly(forecastData.hourly, "forecast", 0, startDate, forecastEnd))

        // Historical part: cutoff+1 → endDate (fetched as last year's dates)
        const histPartStart = shiftDate(cutoff, 1)
        const histFetchStart = shiftDate(histPartStart, -365)
        const histFetchEnd = shiftDate(endDate, -365)
        const archiveData = await fetchArchiveRaw(lat, lng, histFetchStart, histFetchEnd)
        Object.assign(daily, extractDaily(archiveData.daily, "historical", 365, histPartStart, endDate))
        Object.assign(hourly, extractHourly(archiveData.hourly, "historical", 365, histPartStart, endDate))
      }
    }

    const response = NextResponse.json({ daily, hourly } satisfies WeatherResponse)
    response.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=600")
    return response
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 })
  }
}
