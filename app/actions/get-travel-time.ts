"use server"

export async function getTravelTime(
  origin: string,
  destination: string,
): Promise<number | null> {
  if (!origin || !destination) return null
  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) return 0

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&mode=driving` +
      `&key=${apiKey}`

    const res = await fetch(url, { next: { revalidate: 86400 } })
    const data = await res.json()

    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status !== "OK") return null

    return Math.ceil(element.duration.value / 60)
  } catch {
    return null
  }
}
