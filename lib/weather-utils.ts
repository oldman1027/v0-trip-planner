export type WmoDisplay = { icon: string; label: string }

export function getWeatherStrategy(
  tripStartDate: string,
  tripEndDate: string,
): "forecast" | "historical" | "blend" {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + 16)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  if (tripEndDate <= cutoffStr) return "forecast"
  if (tripStartDate > cutoffStr) return "historical"
  return "blend"
}

export function wmoToDisplay(code: number): WmoDisplay {
  if (code === 0) return { icon: "☀️", label: "Clear" }
  if (code === 1 || code === 2) return { icon: "⛅", label: "Partly cloudy" }
  if (code === 3) return { icon: "☁️", label: "Overcast" }
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" }
  if (code === 51 || code === 53 || code === 61 || code === 63) return { icon: "🌧️", label: "Rain" }
  if (code === 71 || code === 73) return { icon: "🌨️", label: "Snow" }
  if (code === 80 || code === 81 || code === 82) return { icon: "🌦️", label: "Showers" }
  if (code === 95 || code === 96 || code === 99) return { icon: "⛈️", label: "Thunderstorm" }
  return { icon: "🌡️", label: "Unknown" }
}

// Returns the spec color for a WMO weather code
export function wmoColor(code: number): string {
  if (code === 95 || code === 96 || code === 99) return "#EF9F27"  // thunderstorm — amber
  if (
    code === 51 || code === 53 || code === 55 ||
    code === 61 || code === 63 || code === 65 ||
    code === 80 || code === 81 || code === 82
  ) return "#60A5FA"                                                // rain/showers/drizzle — blue
  if (
    code === 3 ||
    code === 45 || code === 48 ||
    code === 71 || code === 73 || code === 75 ||
    code === 85 || code === 86
  ) return "#94A3B8"                                                // overcast/fog/snow — slate
  return "#6D8F87"                                                  // clear/partly cloudy — muted teal
}
