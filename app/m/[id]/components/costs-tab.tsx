"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Hotel, Plane, UtensilsCrossed, Target, Package } from "lucide-react"
import type { Booking, Expense, Trip } from "@/lib/types"
import { daysBetween } from "@/lib/dates"

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

const STATUS_BADGE: Record<string, { icon: string; label: string; bg: string; text: string }> = {
  paid:      { icon: "✓", label: "Paid",    bg: "#DCFCE7", text: "#16A34A" },
  estimated: { icon: "~", label: "Est.",    bg: "#FEF9C3", text: "#CA8A04" },
  pending:   { icon: "?", label: "Pending", bg: "#F1F5F9", text: "#64748B" },
}

function ExpenseRow({ e, currency }: { e: Expense; currency: string }) {
  const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
  const badge = STATUS_BADGE[s] ?? STATUS_BADGE.estimated
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: "0.5px solid #EDE8E0" }}
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
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="rounded-full px-1.5 py-px text-[9px] font-medium"
            style={{ background: badge.bg, color: badge.text }}
          >
            {badge.icon} {badge.label}
          </span>
          <span className="text-[11px]" style={{ color: "#B5C4C1" }}>
            {CAT_LABELS[e.category] ?? e.category}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
        {fmt(e.amount, e.currency)}
      </span>
    </div>
  )
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
  const today = new Date().toISOString().slice(0, 10)
  const [view, setView] = useState<"category" | "day">("category")
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set([today]))
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "estimated" | "pending">("all")

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

  // By day — use trip days as the spine so empty days still appear
  const tripDays = daysBetween(trip.start_date, trip.end_date)
  const expensesByDay = tripDays.map((d, i) => {
    const dayExpenses = [...expenses]
      .filter(e => {
        if (e.date !== d) return false
        if (statusFilter === "all") return true
        const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
        return s === statusFilter
      })
      .sort((a, b) => a.description.localeCompare(b.description))
    const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
    const dateLabel = new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    })
    return { date: d, dayNum: i + 1, dateLabel, expenses: dayExpenses, total: dayTotal }
  })

  function toggleDay(d: string) {
    setOpenDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      {/* Total card */}
      <div className="rounded-2xl p-4" style={{ background: "#FDFAF6", border: "0.5px solid #D4C9BC" }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#A9D6C5" }}>
          Total Trip Cost
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
          {fmt(total, currency)}
        </p>

        {total > 0 && (
          <>
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

      {/* View toggle */}
      <div
        className="flex rounded-xl p-0.5"
        style={{ background: "#EDE8E0" }}
      >
        {(["category", "day"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="flex-1 rounded-[10px] py-2 text-xs font-medium transition-all"
            style={
              view === v
                ? { background: "#FDFAF6", color: "#2C4A45", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                : { color: "#9BA8A6" }
            }
          >
            {v === "category" ? "By Category" : "By Day"}
          </button>
        ))}
      </div>

      {/* ── Category view ── */}
      {view === "category" && (
        <>
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

          {/* All expenses flat list */}
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
              <div className="overflow-hidden rounded-2xl" style={{ border: "0.5px solid #E8E0D8", background: "#FFFBF4" }}>
                {[...expenses]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(e => <ExpenseRow key={e.id} e={e} currency={currency} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── By Day view ── */}
      {view === "day" && (
        <div className="flex flex-col gap-3">
        {/* Status filter chips */}
        <div className="flex gap-2">
          {([
            { key: "all",       label: "All" },
            { key: "paid",      label: "✓ Paid" },
            { key: "estimated", label: "~ Est." },
            { key: "pending",   label: "? Pending" },
          ] as const).map(({ key, label }) => {
            const active = statusFilter === key
            const colors: Record<string, { bg: string; text: string; border: string }> = {
              all:       { bg: "#2C4A45", text: "#fff",     border: "#2C4A45" },
              paid:      { bg: "#DCFCE7", text: "#16A34A",  border: "#86EFAC" },
              estimated: { bg: "#FEF9C3", text: "#CA8A04",  border: "#FDE047" },
              pending:   { bg: "#F1F5F9", text: "#64748B",  border: "#CBD5E1" },
            }
            const c = colors[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className="flex-1 rounded-full py-1.5 text-[11px] font-medium transition-all"
                style={
                  active
                    ? { background: c.bg, color: c.text, border: `1px solid ${c.border}` }
                    : { background: "#FFFBF4", color: "#9BA8A6", border: "0.5px solid #D4C9BC" }
                }
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          {expensesByDay.map(({ date, dayNum, dateLabel, expenses: dayExp, total: dayTotal }) => {
            const isOpen = openDays.has(date)
            const isToday = date === today
            return (
              <div
                key={date}
                className="overflow-hidden rounded-2xl"
                style={{ border: `0.5px solid ${isToday ? "#A9D6C5" : "#E8E0D8"}` }}
              >
                {/* Day header — always visible, tap to expand */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  style={{ background: isToday ? "#EDF5F2" : "#FFFBF4", minHeight: 52 }}
                  onClick={() => toggleDay(date)}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: isToday ? "#6D8F87" : "#B5C4C1" }}
                  >
                    {dayNum}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight" style={{ color: "#2C4A45" }}>
                      {dateLabel}
                      {isToday && (
                        <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#6D8F87" }}>
                          Today
                        </span>
                      )}
                    </p>
                    <p className="text-[11px]" style={{ color: "#9BA8A6" }}>
                      {dayExp.length === 0
                        ? "No expenses"
                        : `${dayExp.length} expense${dayExp.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayTotal > 0 && (
                      <span className="text-sm font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
                        {fmt(dayTotal, currency)}
                      </span>
                    )}
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#9BA8A6" }} />
                      : <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#9BA8A6" }} />}
                  </div>
                </button>

                {/* Expanded expenses */}
                {isOpen && (
                  dayExp.length === 0 ? (
                    <p
                      className="px-4 py-3 text-xs"
                      style={{ borderTop: "0.5px solid #EDE8E0", color: "#B5C4C1" }}
                    >
                      No expenses on this day
                    </p>
                  ) : (
                    <div style={{ background: "#FFFBF4" }}>
                      {dayExp.map(e => <ExpenseRow key={e.id} e={e} currency={currency} />)}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
        </div>
      )}
    </div>
  )
}
