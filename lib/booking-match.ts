import type { Activity, Booking } from "@/lib/types"

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** Same date + overlapping title — used to surface "is this a duplicate?" hints. */
export function isLikelyMatch(activityTitle: string, activityDate: string | null, booking: Booking): boolean {
  if (booking.booking_date && activityDate && booking.booking_date !== activityDate) return false
  const na = normalizeTitle(activityTitle)
  const nb = normalizeTitle(booking.title)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export type DuplicatePair = { activity: Activity; booking: Booking }

/**
 * Activities and bookings that represent the same real-world cost but were created
 * independently (no linked_booking_id / booking.details.activity_id), so each is still
 * generating its own expense row in Costs.
 */
export function findDuplicatePairs(activities: Activity[], bookings: Booking[]): DuplicatePair[] {
  const linkedBookingIds = new Set(
    activities.map((a) => a.linked_booking_id).filter((id): id is string => !!id),
  )
  const linkedActivityIds = new Set(
    bookings
      .map((b) => (b.details as Record<string, unknown> | null)?.activity_id)
      .filter((id): id is string => typeof id === "string"),
  )

  const candidateActivities = activities.filter(
    (a) => !a.linked_booking_id && !linkedActivityIds.has(a.id) && (a.cost_amount ?? 0) > 0,
  )
  const candidateBookings = bookings.filter(
    (b) =>
      !linkedBookingIds.has(b.id) &&
      !(b.details as Record<string, unknown> | null)?.activity_id &&
      (b.amount ?? 0) > 0,
  )

  const pairs: DuplicatePair[] = []
  const usedBookingIds = new Set<string>()
  for (const activity of candidateActivities) {
    const match = candidateBookings.find(
      (b) => !usedBookingIds.has(b.id) && isLikelyMatch(activity.title, activity.day_date, b),
    )
    if (match) {
      pairs.push({ activity, booking: match })
      usedBookingIds.add(match.id)
    }
  }
  return pairs
}
