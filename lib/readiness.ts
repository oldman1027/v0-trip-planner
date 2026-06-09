import type { Activity, Booking } from "./types"

export type CategoryStatus = "none" | "unbooked" | "booked"

export type ReadinessStats = {
  score: number             // 0–100, rounded
  booked: number            // activities with booking_id (linked reservation)
  totalBookable: number     // denominator for score
  confirmed: number         // bookings with paid / confirmed status
  pendingPayment: number    // bookings with pending / partial status
  accommodationStatus: CategoryStatus
  transportStatus: CategoryStatus
  conflictCount: number     // activities with at least one scheduling conflict
}

export function computeReadiness(
  activities: Pick<Activity, "id" | "category" | "booking_id" | "is_wishlist">[],
  bookings: Pick<Booking, "id" | "payment_status">[],
  conflictCount = 0,
): ReadinessStats {
  const planned = activities.filter((a) => !a.is_wishlist)

  // Map booking id → payment status for quick lookup
  const paymentStatus = new Map<string, Booking["payment_status"]>()
  for (const b of bookings) paymentStatus.set(b.id, b.payment_status)

  // Key-category buckets
  const accomActs = planned.filter((a) => a.category === "accommodation")
  const transportActs = planned.filter((a) => a.category === "transport")

  const accommodationStatus: CategoryStatus =
    accomActs.length === 0 ? "none"
    : accomActs.some((a) => a.booking_id) ? "booked"
    : "unbooked"

  const transportStatus: CategoryStatus =
    transportActs.length === 0 ? "none"
    : transportActs.some((a) => a.booking_id) ? "booked"
    : "unbooked"

  // Score denominator: key-category activities (whether booked or not) +
  // non-key activities that the user explicitly linked to a booking.
  const nonKeyBooked = planned.filter(
    (a) => a.booking_id && a.category !== "accommodation" && a.category !== "transport",
  )
  const totalBookable = accomActs.length + transportActs.length + nonKeyBooked.length

  // Numerator: all planned activities that have a booking_id
  const booked = planned.filter((a) => a.booking_id).length

  // Payment breakdown — derived from the bookings list
  const confirmed = bookings.filter(
    (b) => b.payment_status === "paid" || b.payment_status === "confirmed",
  ).length
  const pendingPayment = bookings.filter(
    (b) => b.payment_status === "pending" || b.payment_status === "partial",
  ).length

  const score = totalBookable === 0 ? 0 : Math.min(100, Math.round((booked / totalBookable) * 100))

  return { score, booked, totalBookable, confirmed, pendingPayment, accommodationStatus, transportStatus, conflictCount }
}
