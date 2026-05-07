"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Expense, TripBudget, ExpenseCategory } from "@/lib/types"

const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: string }> = {
  accommodation: { label: "Accommodation", icon: "🏨" },
  transport:     { label: "Transport",     icon: "✈️" },
  food:          { label: "Food",          icon: "🍜" },
  activities:    { label: "Activities",    icon: "🎯" },
  other:         { label: "Other",         icon: "📦" },
}

const CATEGORIES: ExpenseCategory[] = ["accommodation", "transport", "food", "activities", "other"]

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

export function BudgetCards({
  expenses,
  budgets,
  currency,
  onSetBudget,
}: {
  expenses: Expense[]
  budgets: TripBudget[]
  currency: string
  onSetBudget: (category: ExpenseCategory, amount: number) => Promise<void>
}) {
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null)
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)

  const budgetMap = new Map(budgets.map((b) => [b.category, b.budget_amount]))

  function spentFor(cat: ExpenseCategory) {
    return expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)
  }

  async function saveBudget(cat: ExpenseCategory) {
    const amount = parseFloat(input)
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount")
      return
    }
    setSaving(true)
    try {
      await onSetBudget(cat, amount)
      setEditingCat(null)
      setInput("")
    } catch {
      toast.error("Could not save budget")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CATEGORIES.map((cat) => {
        const budget = budgetMap.get(cat)
        const spent = spentFor(cat)
        const pct = budget ? Math.min((spent / budget) * 100, 100) : 0
        const over = budget != null && spent > budget
        const meta = CATEGORY_META[cat]
        const isEditing = editingCat === cat

        return (
          <div
            key={cat}
            className="flex flex-col gap-2.5 rounded-2xl border border-border p-4 transition-colors"
            style={{
              backgroundColor:
                budget != null ? (over ? "#FFF0EF" : "#F2FBF6") : undefined,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5">
              <span className="text-lg" aria-hidden>{meta.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </span>
            </div>

            {/* Spent */}
            <div>
              <div className="text-xl font-bold tabular-nums leading-tight">
                {fmt(spent, currency)}
              </div>
              {budget != null && (
                <div className="text-[11px] text-muted-foreground">
                  of {fmt(budget, currency)}
                </div>
              )}
            </div>

            {/* Progress bar */}
            {budget != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: over ? "#F7A59E" : "#B1DDC6",
                  }}
                />
              </div>
            )}

            {/* Over-budget badge */}
            {over && budget != null && (
              <div
                className="rounded-lg px-2 py-0.5 text-center text-[10px] font-semibold"
                style={{ backgroundColor: "#F7A59E", color: "#7B1A1A" }}
              >
                +{fmt(spent - budget, currency)} over
              </div>
            )}

            {/* Budget edit */}
            {isEditing ? (
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={input}
                  autoFocus
                  disabled={saving}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveBudget(cat)
                    if (e.key === "Escape") {
                      setEditingCat(null)
                      setInput("")
                    }
                  }}
                  onBlur={() => {
                    if (input.trim()) saveBudget(cat)
                    else { setEditingCat(null); setInput("") }
                  }}
                  placeholder="Budget"
                  className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={saving}
                  onMouseDown={(e) => { e.preventDefault(); saveBudget(cat) }}
                  className="rounded-lg bg-primary px-2.5 text-[10px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "…" : "Set"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingCat(cat)
                  setInput(budget != null ? String(budget) : "")
                }}
                className={cn(
                  "text-left text-[11px] font-medium transition-colors hover:underline",
                  over ? "text-red-600" : "text-primary",
                )}
              >
                {budget != null ? "Edit budget" : "Set budget"}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
