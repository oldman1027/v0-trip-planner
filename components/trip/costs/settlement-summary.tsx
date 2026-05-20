"use client"

import { useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Expense, ExpenseParticipant } from "@/lib/types"

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

function computeSettlements(expenses: Expense[], participants: ExpenseParticipant[]) {
  const balances = new Map<string, number>()
  for (const p of participants) balances.set(p.id, 0)

  for (const expense of expenses) {
    if (!expense.paid_by_participant_id) continue
    const payer = expense.paid_by_participant_id
    for (const split of expense.splits ?? []) {
      if (!split.participant_id) continue
      if (split.settled || split.paid) continue
      if (split.participant_id === payer) continue
      balances.set(payer, (balances.get(payer) ?? 0) + split.amount)
      balances.set(split.participant_id, (balances.get(split.participant_id) ?? 0) - split.amount)
    }
  }

  // Greedy minimisation — minimises number of transactions
  const result: Array<{ from: string; to: string; amount: number }> = []
  const debtors   = Array.from(balances.entries()).filter(([, v]) => v < -0.01).sort(([, a], [, b]) => a - b)
  const creditors = Array.from(balances.entries()).filter(([, v]) => v >  0.01).sort(([, a], [, b]) => b - a)

  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const debt   = -debtors[i][1]
    const credit =  creditors[j][1]
    const settle = Math.min(debt, credit)
    result.push({ from: debtors[i][0], to: creditors[j][0], amount: settle })
    debtors[i]   = [debtors[i][0],   debtors[i][1]   + settle]
    creditors[j] = [creditors[j][0], creditors[j][1] - settle]
    if (Math.abs(debtors[i][1])   < 0.01) i++
    if (Math.abs(creditors[j][1]) < 0.01) j++
  }

  return result
}

function computeBalances(expenses: Expense[], participants: ExpenseParticipant[]) {
  const balances = new Map<string, number>()
  for (const p of participants) balances.set(p.id, 0)

  for (const expense of expenses) {
    if (!expense.paid_by_participant_id) continue
    const payer = expense.paid_by_participant_id
    for (const split of expense.splits ?? []) {
      if (!split.participant_id) continue
      if (split.settled || split.paid) continue
      if (split.participant_id === payer) continue
      balances.set(payer, (balances.get(payer) ?? 0) + split.amount)
      balances.set(split.participant_id, (balances.get(split.participant_id) ?? 0) - split.amount)
    }
  }

  return Array.from(balances.entries()).map(([id, amount]) => ({
    id,
    name: participants.find((p) => p.id === id)?.name ?? "Unknown",
    amount,
  }))
}

function groupExpensesByCurrency(expenses: Expense[]): Map<string, Expense[]> {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    const cur = e.currency ?? "THB"
    if (!map.has(cur)) map.set(cur, [])
    map.get(cur)!.push(e)
  }
  return map
}

export function SettlementSummary({
  expenses,
  participants,
  currency,
}: {
  expenses: Expense[]
  participants: ExpenseParticipant[]
  currency: string
}) {
  const [view, setView] = useState<"plan" | "balances">("plan")

  const settlementsByCurrency = useMemo(() => {
    const groups = groupExpensesByCurrency(expenses)
    return Array.from(groups.entries()).map(([cur, exps]) => ({
      cur,
      settlements: computeSettlements(exps, participants),
    }))
  }, [expenses, participants])

  const balancesByCurrency = useMemo(() => {
    const groups = groupExpensesByCurrency(expenses)
    return Array.from(groups.entries()).map(([cur, exps]) => ({
      cur,
      balances: computeBalances(exps, participants),
    }))
  }, [expenses, participants])

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Unknown"
  const hasAnySettlements = settlementsByCurrency.some(({ settlements }) => settlements.length > 0)
  const multiCurrency = settlementsByCurrency.length > 1

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg">Who Owes Whom</h3>
        <div className="flex overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setView("plan")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              view === "plan"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            Settlement plan
          </button>
          <button
            type="button"
            onClick={() => setView("balances")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              view === "balances"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            Balances
          </button>
        </div>
      </div>

      {view === "plan" ? (
        !hasAnySettlements ? (
          <p className="text-sm text-muted-foreground">All settled up 🎉</p>
        ) : (
          <div className="flex flex-col gap-4">
            {settlementsByCurrency
              .filter(({ settlements }) => settlements.length > 0)
              .map(({ cur, settlements }) => (
                <div key={cur}>
                  {multiCurrency && (
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {cur}
                    </p>
                  )}
                  <div className="flex flex-col gap-2.5">
                    {settlements.map(({ from, to, amount }, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{nameOf(from)}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          <span className="font-medium">{nameOf(to)}</span>
                        </div>
                        <span className="tabular-nums text-sm font-semibold" style={{ color: "#de4a66" }}>
                          {fmt(amount, cur)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {balancesByCurrency.map(({ cur, balances }) => (
            <div key={cur}>
              {multiCurrency && (
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {cur}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {balances.map(({ id, name, amount }) => (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5"
                  >
                    <span className="text-sm font-medium">{name}</span>
                    <span
                      className={cn(
                        "tabular-nums text-sm font-semibold",
                        amount > 0.01  && "text-emerald-600 dark:text-emerald-400",
                        amount < -0.01 && "text-red-600 dark:text-red-400",
                        Math.abs(amount) <= 0.01 && "text-muted-foreground",
                      )}
                    >
                      {amount > 0 ? "+" : ""}
                      {fmt(amount, cur)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
