import { differenceInHours, differenceInDays } from "date-fns"

export type DeadlineUrgency = "critical" | "warning" | null

/**
 * critical = ≤ 48 h remaining
 * warning  = ≤ 7 days remaining (but > 48 h)
 * null     = > 7 days, already past, or no deadline set
 */
export function deadlineUrgency(deadlineIso: string | null): DeadlineUrgency {
  if (!deadlineIso) return null
  const deadline = new Date(deadlineIso)
  const now = new Date()
  if (deadline <= now) return null
  const hours = differenceInHours(deadline, now)
  if (hours <= 48) return "critical"
  if (hours <= 7 * 24) return "warning"
  return null
}

/** Short human label: "18h left", "3d left". Null when no deadline or already past. */
export function deadlineLabel(deadlineIso: string | null): string | null {
  if (!deadlineIso) return null
  const deadline = new Date(deadlineIso)
  const now = new Date()
  if (deadline <= now) return null
  const hours = differenceInHours(deadline, now)
  if (hours < 24) return `${hours}h left`
  return `${differenceInDays(deadline, now)}d left`
}

/**
 * Days from today until the booking date (local-date aware, no UTC drift).
 * Returns null when no date is set or the date is in the past.
 */
export function daysUntilBooking(bookingDate: string | null): number | null {
  if (!bookingDate) return null
  const [y, m, d] = bookingDate.split("-").map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = differenceInDays(date, today)
  return diff >= 0 ? diff : null
}
