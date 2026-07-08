"use client"

import { groupTotal } from "@/lib/expense-utils"
import type { Expense, ExpenseStatus } from "@/lib/types"

const STATUS_META: Record<ExpenseStatus, { label: string; icon: string; color: string; bg: string; text: string }> = {
  paid:      { label: "Paid",      icon: "✓", color: "#22C55E", bg: "#DCFCE7", text: "#16A34A" },
  estimated: { label: "Estimated", icon: "~", color: "#EF9F27", bg: "#FEF9C3", text: "#CA8A04" },
  pending:   { label: "Pending",   icon: "?", color: "#CBD5E1", bg: "#F1F5F9", text: "#64748B" },
}

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

export function StatusDashboard({
  expenses,
  currency,
  partySize,
}: {
  expenses: Expense[]
  currency: string
  partySize: number
}) {
  const totals: Record<ExpenseStatus, number> = { paid: 0, estimated: 0, pending: 0 }
  for (const e of expenses) {
    const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
    totals[s] = (totals[s] ?? 0) + groupTotal(e, partySize)
  }

  const grand = totals.paid + totals.estimated + totals.pending
  const stillNeeded = totals.estimated + totals.pending
  const pct = (v: number) => (grand > 0 ? (v / grand) * 100 : 0)

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* Total trip cost card */}
      <div
        className="flex-1 rounded-2xl p-5"
        style={{ background: "#FDFAF6", border: "0.5px solid #D4C9BC" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#A9D6C5" }}>
          Total Trip Cost
        </p>
        <p className="mt-1 text-[22px] font-medium tabular-nums" style={{ color: "#2C4A45" }}>
          {fmt(grand, currency)}
        </p>

        {grand > 0 && (
          <>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full" style={{ background: "#E8E0D8" }}>
              {(["paid", "estimated", "pending"] as ExpenseStatus[]).map((s) => {
                const w = pct(totals[s])
                if (w < 0.5) return null
                return (
                  <div
                    key={s}
                    className="h-full transition-all"
                    style={{ width: `${w}%`, background: STATUS_META[s].color }}
                  />
                )
              })}
            </div>

            <div className="my-3" style={{ borderTop: "0.5px solid #E8E0D8" }} />

            <div className="flex flex-col gap-2">
              {(["paid", "estimated", "pending"] as ExpenseStatus[]).map((s) => {
                const meta = STATUS_META[s]
                const pctVal = Math.round(pct(totals[s]))
                return (
                  <div key={s} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: meta.bg, color: meta.text }}
                      >
                        {meta.icon}
                      </span>
                      <span className="text-[12px]" style={{ color: "#9BA8A6" }}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-medium tabular-nums" style={{ color: "#2C4A45" }}>
                        {fmt(totals[s], currency)}
                      </span>
                      <span className="w-8 text-right text-[11px] tabular-nums" style={{ color: "#B5C4C1" }}>
                        {pctVal}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Still to pay card */}
      {stillNeeded > 0 && (
        <div
          className="flex flex-col justify-between rounded-2xl p-5 sm:w-[220px]"
          style={{ background: "#EDF5F2", border: "0.5px solid #A9D6C5" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6D8F87" }}>
              Still to pay
            </p>
            <p className="mt-1 text-[20px] font-medium tabular-nums" style={{ color: "#2C4A45" }}>
              {fmt(stillNeeded, currency)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "#9BA8A6" }}>
              Estimated + Pending
            </p>
          </div>
          <p className="mt-4 text-[11px] italic" style={{ color: "#6D8F87" }}>
            💡 Add 10–15% buffer →{" "}
            <span className="font-medium not-italic tabular-nums">
              {fmt(Math.ceil(stillNeeded * 1.125), currency)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
