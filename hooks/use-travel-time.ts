import { useState, useEffect } from "react"

interface TravelTime {
  driveMinutes: number | null
  loading: boolean
}

const cache = new Map<string, number | null>()

export function useTravelTime(
  origin: string | null,
  destination: string | null,
): TravelTime {
  const [driveMinutes, setDriveMinutes] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!origin?.trim() || !destination?.trim()) {
      setDriveMinutes(null)
      setLoading(false)
      return
    }
    if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setDriveMinutes(0)
      setLoading(false)
      return
    }

    const key = `${origin}|||${destination}`

    if (cache.has(key)) {
      setDriveMinutes(cache.get(key) ?? null)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(
      `/api/travel-time?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
    )
      .then((r) => r.json())
      .then((data: { minutes: number | null }) => {
        cache.set(key, data.minutes)
        setDriveMinutes(data.minutes)
        setLoading(false)
      })
      .catch(() => {
        cache.set(key, null)
        setDriveMinutes(null)
        setLoading(false)
      })
  }, [origin, destination])

  return { driveMinutes, loading }
}
