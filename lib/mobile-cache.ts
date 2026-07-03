import type { Activity, Booking, Expense } from "@/lib/types"

const PREFIX = "tripletto_mobile_"

type CachePayload = {
  activities: Activity[]
  bookings: Booking[]
  expenses: Expense[]
  syncedAt: number
}

export function saveMobileCache(tripId: string, data: Omit<CachePayload, "syncedAt">) {
  try {
    const payload: CachePayload = { ...data, syncedAt: Date.now() }
    localStorage.setItem(PREFIX + tripId, JSON.stringify(payload))
  } catch {}
}

export function loadMobileCache(tripId: string): CachePayload | null {
  try {
    const raw = localStorage.getItem(PREFIX + tripId)
    if (!raw) return null
    return JSON.parse(raw) as CachePayload
  } catch {
    return null
  }
}

export function formatSyncTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return "just now"
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString()
}

export function getInstallDismissed(): boolean {
  try {
    return localStorage.getItem("tripletto_install_dismissed") === "1"
  } catch {
    return false
  }
}

export function setInstallDismissed() {
  try {
    localStorage.setItem("tripletto_install_dismissed", "1")
  } catch {}
}
