"use client"

import { Hotel, Plane, UtensilsCrossed, Target, Package } from "lucide-react"
import type { Booking, Expense, Trip } from "@/lib/types"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
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

  // Status totals
  const statusTotals = expenses.reduce((acc, e) => {
    const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
    acc[s] = (acc[s] ?? 0) + e.amount
    return acc
  }, { paid: 0, estimated: 0, pending: 0 } as Record<string, number>)
  const stillNeeded = (statusTotals.estimated ?? 0) + (statusTotals.pending ?? 0)

  // By category
  const byCategory = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {} as Record<string, number>),
  ).sort(([, a], [, b]) => b - a)

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      {/* Total card with 3-status breakdown */}
      <div className="rounded-2xl p-4" style={{ background: "#FDFAF6", border: "0.5px solid #D4C9BC" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#A9D6C5" }}>
          Total Trip Cost
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
          {fmt(total, currency)}
        </p>

        {total > 0 && (
          <>
            {/* Segmented bar */}
            <div className="mt-3 flex h-2 overflow-hidden rounded-full" style={{ background: "#E8E0D8" }}>
              {[
                { key: "paid",      color: "#22C55E" },
                { key: "estimated", color: "#EF9F27" },
                { key: "pending",   color: "#CBD5E1" },
              ].map(({ key, color }) => {
                const w = total > 0 ? ((statusTotals[key] ?? 0) / total) * 100 : 0
                return w > 0.5 ? (
                  <div key={key} className="h-full" style={{ width: `${w}%`, background: color }} />
                ) : null
              })}
            </div>

            {/* Status rows */}
            <div className="mt-3 flex flex-col gap-1.5">
              {[
                { key: "paid",      icon: "✓", label: "Paid",      color: "#22C55E" },
                { key: "estimated", icon: "~", label: "Estimated", color: "#EF9F27" },
                { key: "pending",   icon: "?", label: "Pending",   color: "#CBD5E1" },
              ].map(({ key, icon, label, color }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold" style={{ color }}>{icon}</span>
                    <span className="text-[11px]" style={{ color: "#9BA8A6" }}>{label}</span>
                  </div>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: "#2C4A45" }}>
                    {fmt(statusTotals[key] ?? 0, currency)}
                  </span>
                </div>
              ))}
            </div>

            {stillNeeded > 0 && (
              <div className="mt-3 rounded-xl p-2.5" style={{ background: "#EDF5F2", border: "0.5px solid #A9D6C5" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: "#6D8F87" }}>Still to pay</span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
                    {fmt(stillNeeded, currency)}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] italic" style={{ color: "#9BA8A6" }}>
                  +15% buffer → {fmt(Math.ceil(stillNeeded * 1.15), currency)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

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
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "#9BA8A6" }}>
                    <span>
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {(() => {
                      const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
                      const badge = {
                        paid:      { icon: "✓", label: "Paid",    bg: "#DCFCE7", text: "#16A34A" },
                        estimated: { icon: "~", label: "Est.",    bg: "#FEF9C3", text: "#CA8A04" },
                        pending:   { icon: "?", label: "Pending", bg: "#F1F5F9", text: "#64748B" },
                      }[s] ?? { icon: "~", label: "Est.", bg: "#FEF9C3", text: "#CA8A04" }
                      return (
                        <span
                          className="rounded-full px-1.5 py-px text-[9px] font-medium"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {badge.icon} {badge.label}
                        </span>
                      )
                    })()}
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
