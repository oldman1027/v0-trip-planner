"use client"

import { DollarSign, Hotel, Plane, UtensilsCrossed, Target, Package } from "lucide-react"
import type { Booking, Expense, Trip } from "@/lib/types"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function isPrepaid(expense: Expense): boolean {
  return (
    expense.source_type === "booking" &&
    (expense.category === "accommodation" || expense.category === "transport")
  )
}

const CAT_ICONS: Record<string, React.ReactNode> = {
  accommodation: <Hotel className="h-4 w-4" />,
  transport:     <Plane className="h-4 w-4" />,
  food:          <UtensilsCrossed className="h-4 w-4" />,
  activities:    <Target className="h-4 w-4" />,
  other:         <Package className="h-4 w-4" />,
}

const CAT_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  transport:     "Transport",
  food:          "Dining",
  activities:    "Activities",
  other:         "Other",
}

export function CostsTab({
  trip,
  expenses,
  bookings,
}: {
  trip: Trip
  expenses: Expense[]
  bookings: Booking[]
}) {
  const currency = trip.default_currency ?? "USD"

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Cash-only (excludes prepaid and paid bookings)
  const paidBookingIds = new Set(
    bookings.filter(b => b.payment_status === "paid").map(b => b.id),
  )
  const cashExpenses = expenses.filter(
    e => !isPrepaid(e) && !(e.booking_id && paidBookingIds.has(e.booking_id)),
  )
  const cashTotal = cashExpenses.reduce((s, e) => s + e.amount, 0)

  // By category
  const byCategory = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {} as Record<string, number>),
  ).sort(([, a], [, b]) => b - a)

  const paidTotal = expenses
    .filter(e => e.booking_id && paidBookingIds.has(e.booking_id))
    .reduce((s, e) => s + e.amount, 0)
  const paidPct = total > 0 ? Math.round((paidTotal / total) * 100) : 0

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      {/* Total card */}
      <div className="rounded-2xl p-4" style={{ background: "#EDF5F2", border: "0.5px solid #A9D6C5" }}>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: "#6D8F87" }} />
          <p className="text-xs font-medium" style={{ color: "#6D8F87" }}>Total estimated</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
          {fmt(total, currency)}
        </p>

        {/* Progress bar: paid vs total */}
        {total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px]" style={{ color: "#9BA8A6" }}>
              <span>{paidPct}% confirmed paid</span>
              <span>{fmt(paidTotal, currency)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#D4C9BC" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${paidPct}%`, background: "#6D8F87" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cash planning */}
      {cashTotal > 0 && (
        <div className="rounded-2xl border p-4" style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
            Cash to Exchange
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "#2C4A45" }}>Local cash needed</span>
            <span className="text-base font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
              {fmt(cashTotal, currency)}
            </span>
          </div>
          <p className="mt-2 text-xs italic" style={{ color: "#9BA8A6" }}>
            Add 10–15% buffer → {fmt(Math.ceil(cashTotal * 1.13), currency)} total to change
          </p>
        </div>
      )}

      {/* By category */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
            By Category
          </p>
          <div className="flex flex-col gap-2.5">
            {byCategory.map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "#EDF5F2", color: "#6D8F87" }}
                >
                  {CAT_ICONS[cat] ?? <Package className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#2C4A45" }}>
                      {CAT_LABELS[cat] ?? cat}
                    </span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
                      {fmt(amt, currency)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "#E8E0D8" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((amt / total) * 100)}%`, background: "#6D8F87" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent expenses */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
          All Expenses
        </p>
        {expenses.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed py-10 text-center text-sm"
            style={{ borderColor: "#D4C9BC", color: "#9BA8A6" }}
          >
            No expenses yet
          </div>
        ) : (
          [...expenses]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(e => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "#EDF5F2", color: "#6D8F87" }}
                >
                  {CAT_ICONS[e.category] ?? <Package className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "#2C4A45" }}>
                    {e.description}
                  </p>
                  <div className="mt-0.5 flex gap-2 text-xs" style={{ color: "#9BA8A6" }}>
                    <span>
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {e.booking_id && (
                      <span
                        className="rounded-full px-1.5 py-px text-[10px] font-medium"
                        style={{ background: "#EDF5F2", color: "#6D8F87" }}
                      >
                        booking
                      </span>
                    )}
                    {e.activity_id && (
                      <span
                        className="rounded-full px-1.5 py-px text-[10px] font-medium"
                        style={{ background: "#A9D6C5", color: "#2C4A45" }}
                      >
                        itinerary
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
                  {fmt(e.amount, e.currency)}
                </span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
