"use client"

import { daysBetween, parseDateOnly } from "@/lib/dates"
import { format } from "date-fns"
import type { Activity, Expense, Trip } from "@/lib/types"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function cityFromLocation(location: string | null | undefined): string | null {
  if (!location) return null
  return location.split(",")[0]?.trim() || null
}

/** Prepaid bookings (flights/hotels) are usually paid online/by card before the trip. */
function isPrepaid(expense: Expense): boolean {
  return expense.source_type === "booking" && (expense.category === "accommodation" || expense.category === "transport")
}

function sumByCurrency(expenses: Expense[], fallbackCurrency: string): Array<[string, number]> {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    const cur = e.currency || fallbackCurrency
    totals.set(cur, (totals.get(cur) ?? 0) + e.amount)
  }
  return [...totals.entries()].filter(([, v]) => v > 0)
}

type CityRange = { label: string; days: string[] }

function buildCityRanges(days: string[], activities: Activity[]): CityRange[] {
  const dayCounts = new Map<string, Map<string, number>>()
  for (const a of activities) {
    if (!a.day_date) continue
    const city = cityFromLocation(a.location)
    if (!city) continue
    const m = dayCounts.get(a.day_date) ?? new Map<string, number>()
    m.set(city, (m.get(city) ?? 0) + 1)
    dayCounts.set(a.day_date, m)
  }
  const cityForDay = new Map<string, string>()
  for (const [date, counts] of dayCounts) {
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top) cityForDay.set(date, top[0])
  }

  const groups: { city: string | null; days: string[] }[] = []
  for (const day of days) {
    const city = cityForDay.get(day) ?? null
    const last = groups[groups.length - 1]
    if (last && last.city === city) last.days.push(day)
    else groups.push({ city, days: [day] })
  }

  return groups.map((g, i) => {
    const start = g.days[0]!
    const isLast = i === groups.length - 1
    const end = isLast ? g.days[g.days.length - 1]! : groups[i + 1]!.days[0]!
    const range = `${format(parseDateOnly(start), "MMM d")} – ${format(parseDateOnly(end), "MMM d")}`
    const label = g.city ? `${range} (${g.city})` : range
    return { label, days: g.days }
  })
}

export function CashPlanningCard({
  trip,
  expenses,
  activities,
}: {
  trip: Trip
  expenses: Expense[]
  activities: Activity[]
}) {
  const currency = trip.default_currency ?? "USD"
  const days = daysBetween(trip.start_date, trip.end_date)

  const preTrip = expenses.filter(isPrepaid)
  const cashExpenses = expenses.filter((e) => !isPrepaid(e))

  const cityRanges = buildCityRanges(days, activities)
  const cashByDate = new Map<string, Expense[]>()
  for (const e of cashExpenses) {
    const list = cashByDate.get(e.date) ?? []
    list.push(e)
    cashByDate.set(e.date, list)
  }

  const sections = cityRanges
    .map((range) => {
      const rangeExpenses = range.days.flatMap((d) => cashByDate.get(d) ?? [])
      return { label: range.label, entries: sumByCurrency(rangeExpenses, currency) }
    })
    .filter((s) => s.entries.length > 0)

  const preTripEntries = sumByCurrency(preTrip, currency)

  const grandTotal = sumByCurrency(expenses, currency)

  if (preTripEntries.length === 0 && sections.length === 0) {
    return (
      <div
        className="text-center text-sm"
        style={{
          background: "#FDFAF6",
          border: "0.5px solid #D4C9BC",
          borderRadius: 16,
          padding: "32px 16px",
          color: "#6D8F87",
        }}
      >
        No expenses yet — add some to see your cash plan.
      </div>
    )
  }

  return (
    <div
      style={{
        background: "#FDFAF6",
        border: "0.5px solid #D4C9BC",
        borderRadius: 16,
        padding: "16px 20px",
      }}
    >
      <div className="mb-3 text-sm font-medium" style={{ color: "#2C4A45" }}>
        Cash Needed by Date
      </div>

      <div className="flex flex-col gap-3">
        {preTripEntries.length > 0 && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px]" style={{ color: "#6D8F87" }}>
                Before {format(parseDateOnly(trip.start_date), "MMM d")} (pre-trip)
              </div>
              <div className="mt-0.5 text-base font-medium" style={{ color: "#2C4A45" }}>
                {preTripEntries.map(([cur, amt], i) => (
                  <span key={cur}>
                    {i > 0 && <span className="mx-1.5 text-muted-foreground">·</span>}
                    {fmt(amt, cur)}
                  </span>
                ))}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "#EFE7DA", color: "#8A7A5E" }}
            >
              Pay in {currency}/online
            </span>
          </div>
        )}

        {sections.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div>
              <div className="text-[11px]" style={{ color: "#6D8F87" }}>
                {s.label}
              </div>
              <div className="mt-0.5 text-base font-medium" style={{ color: "#2C4A45" }}>
                {s.entries.map(([cur, amt], i) => (
                  <span key={cur}>
                    {i > 0 && <span className="mx-1.5 text-muted-foreground">·</span>}
                    {fmt(amt, cur)}
                  </span>
                ))}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "#A9D6C5", color: "#2C4A45" }}
            >
              Cash in {currency}
            </span>
          </div>
        ))}
      </div>

      <div style={{ height: "0.5px", background: "#D4C9BC", margin: "14px 0 10px" }} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#2C4A45" }}>
          Total to change
        </span>
        <span className="text-sm font-medium tabular-nums" style={{ color: "#2C4A45" }}>
          {grandTotal.map(([cur, amt], i) => (
            <span key={cur}>
              {i > 0 && <span className="mx-1.5 text-muted-foreground">·</span>}
              {fmt(amt, cur)}
            </span>
          ))}
        </span>
      </div>

      <p className="mt-3 text-[11px] italic" style={{ color: "#9BA8A6" }}>
        Estimates based on itinerary costs. Actual cash needed may vary — keep a 10-15% buffer for incidentals.
      </p>
    </div>
  )
}
