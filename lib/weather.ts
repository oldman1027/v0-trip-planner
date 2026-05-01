export type WeatherData = {
  location: string
  current: {
    temperature: number
    description: string
    icon: string
  }
  forecast: Array<{
    date: string
    high: number
    low: number
    description: string
    icon: string
  }>
}

/**
 * Geocode a destination name to coordinates using Open-Meteo Geocoding API
 */
export async function geocodeDestination(
  destination: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`,
      { cache: "force-cache" }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ latitude: number; longitude: number }> }
    const result = data.results?.[0]
    return result ? { latitude: result.latitude, longitude: result.longitude } : null
  } catch {
    return null
  }
}

/**
 * Fetch weather forecast for a given latitude/longitude using Open-Meteo API
 */
export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  destination: string
): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=16&timezone=auto&format=json`,
      { cache: "force-cache" }
    )
    if (!res.ok) return null
    const data = (await res.json()) as any
    const current = data.current
    const daily = data.daily

    return {
      location: destination,
      current: {
        temperature: Math.round(current.temperature_2m),
        description: getWeatherDescription(current.weather_code),
        icon: getWeatherIcon(current.weather_code),
      },
      forecast: daily.time.map((date: string, i: number) => ({
        date,
        high: Math.round(daily.temperature_2m_max[i]),
        low: Math.round(daily.temperature_2m_min[i]),
        description: getWeatherDescription(daily.weather_code[i]),
        icon: getWeatherIcon(daily.weather_code[i]),
      })),
    }
  } catch {
    return null
  }
}

function getWeatherDescription(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0) return "Clear sky"
  if (code === 1 || code === 2) return "Mostly clear"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Foggy"
  if (code === 51 || code === 53 || code === 55) return "Drizzle"
  if (code === 61 || code === 63 || code === 65) return "Rain"
  if (code === 71 || code === 73 || code === 75) return "Snow"
  if (code === 80 || code === 81 || code === 82) return "Showers"
  if (code === 85 || code === 86) return "Snow showers"
  if (code === 95 || code === 96 || code === 99) return "Thunderstorm"
  return "Unknown"
}

function getWeatherIcon(code: number): string {
  if (code === 0) return "☀️"
  if (code === 1 || code === 2) return "🌤️"
  if (code === 3) return "☁️"
  if (code === 45 || code === 48) return "🌫️"
  if (code === 51 || code === 53 || code === 55) return "🌦️"
  if (code === 61 || code === 63 || code === 65) return "🌧️"
  if (code === 71 || code === 73 || code === 75) return "❄️"
  if (code === 80 || code === 81 || code === 82) return "🌧️"
  if (code === 85 || code === 86) return "🌨️"
  if (code === 95 || code === 96 || code === 99) return "⛈️"
  return "❓"
}
