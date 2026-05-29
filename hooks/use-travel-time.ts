import { useState, useEffect } from "react"
import { getTravelTime } from "@/app/actions/get-travel-time"

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
    if (!origin || !destination) {
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
    getTravelTime(origin, destination).then((minutes) => {
      cache.set(key, minutes)
      setDriveMinutes(minutes)
      setLoading(false)
    })
  }, [origin, destination])

  return { driveMinutes, loading }
}
