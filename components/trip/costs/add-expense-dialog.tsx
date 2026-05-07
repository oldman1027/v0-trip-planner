"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Expense, ExpenseCategory, Trip, MemberWithProfile } from "@/lib/types"

const CATEGORIES: { value: ExpenseCategory; icon: string; label: string }[] = [
  { value: "accommodation", icon: "🏨", label: "Accommodation" },
  { value: "transport",     icon: "✈️", label: "Transport" },
  { value: "food",          icon: "🍜", label: "Food" },
  { value: "activities",    icon: "🎯", label: "Activities" },
  { value: "other",         icon: "📦", label: "Other" },
]

type SplitMode = "none" | "equal" | "custom"

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

export function AddExpenseDialog({
  open,
  expense,
  trip,
  members,
  currentUserId,
  onClose,
  onSave,
}: {
  open: boolean
  expense: Expense | null
  trip: Trip
  members: MemberWithProfile[]
  currentUserId: string
  onClose: () => void
  onSave: (input: {
    id?: string
    description: string
    amount: number
    currency: string
    category: ExpenseCategory
    date: string
    paid_by_user_id: string
    splits: { user_id: string; amount: number }[]
  }) => Promise<void>
}) {
  const currency = trip.default_currency ?? "USD"

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("other")
  const [date, setDate] = useState(trip.start_date)
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [splitMode, setSplitMode] = useState<SplitMode>("equal")
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.user_id)),
  )
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (expense) {
      setDescription(expense.description)
      setAmount(String(expense.amount))
      setCategory(expense.category)
      setDate(expense.date)
      setPaidBy(expense.paid_by_user_id)
      const splits = expense.splits ?? []
      if (splits.length === 0) {
        setSplitMode("none")
        setSelectedMembers(new Set(members.map((m) => m.user_id)))
        setCustomAmounts({})
      } else {
        const equalAmt = expense.amount / splits.length
        const isEqual = splits.every((s) => Math.abs(s.amount - equalAmt) < 0.02)
        setSplitMode(isEqual ? "equal" : "custom")
        setSelectedMembers(new Set(splits.map((s) => s.user_id)))
        const amounts: Record<string, string> = {}
        for (const s of splits) amounts[s.user_id] = String(s.amount)
        setCustomAmounts(amounts)
      }
    } else {
      setDescription("")
      setAmount("")
      setCategory("other")
      setDate(trip.start_date)
      setPaidBy(currentUserId)
      setSplitMode("equal")
      setSelectedMembers(new Set(members.map((m) => m.user_id)))
      setCustomAmounts({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const totalAmt = parseFloat(amount) || 0
  const includedMembers = members.filter((m) => selectedMembers.has(m.user_id))
  const perPerson = includedMembers.length > 0 ? totalAmt / includedMembers.length : 0
  const customTotal = includedMembers.reduce(
    (s, m) => s + (parseFloat(customAmounts[m.user_id] ?? "0") || 0),
    0,
  )
  const customBalanced = totalAmt > 0 && Math.abs(customTotal - totalAmt) < 0.5

  function computeSplits(): { user_id: string; amount: number }[] {
    if (splitMode === "none" || includedMembers.length === 0) return []
    if (splitMode === "equal") {
      const each = Math.round((totalAmt / includedMembers.length) * 100) / 100
      return includedMembers.map((m) => ({ user_id: m.user_id, amount: each }))
    }
    return includedMembers
      .map((m) => ({
        user_id: m.user_id,
        amount: Math.round((parseFloat(customAmounts[m.user_id] ?? "0") || 0) * 100) / 100,
      }))
      .filter((s) => s.amount > 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { toast.error("Enter a description"); return }
    if (isNaN(totalAmt) || totalAmt <= 0) { toast.error("Enter a valid amount"); return }
    if (!date) { toast.error("Select a date"); return }
    if (splitMode === "custom" && !customBalanced) {
      toast.error(`Split total must equal ${fmt(totalAmt, currency)}`)
      return
    }
    setSaving(true)
    try {
      await onSave({
        id: expense?.id,
        description: description.trim(),
        amount: totalAmt,
        currency,
        category,
        date,
        paid_by_user_id: paidBy,
        splits: computeSplits(),
      })
    } catch {
      toast.error("Could not save expense")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-serif text-2xl">
            {expense ? "Edit Expense" : "Add Expense"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner at Somtum Der"
            />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Amount ({currency})</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors",
                    category === cat.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={date}
              min={trip.start_date}
              max={trip.end_date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Paid by */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Paid by</label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const name = m.profile?.full_name ?? "Unknown"
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => setPaidBy(m.user_id)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                      paidBy === m.user_id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Split type</label>
            <div className="flex gap-1.5">
              {(
                [
                  { value: "none" as SplitMode, label: "No split" },
                  { value: "equal" as SplitMode, label: "Equal split" },
                  { value: "custom" as SplitMode, label: "Custom" },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSplitMode(opt.value)}
                  className={cn(
                    "flex-1 rounded-xl border px-2 py-1.5 text-xs font-medium transition-colors",
                    splitMode === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split members */}
          {splitMode !== "none" && members.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {splitMode === "equal"
                  ? `Who's included${perPerson > 0 ? ` · ${fmt(perPerson, currency)} each` : ""}`
                  : "Custom amounts"}
              </label>
              <div className="flex flex-col gap-2">
                {members.map((m) => {
                  const name = m.profile?.full_name ?? "Unknown"
                  const selected = selectedMembers.has(m.user_id)
                  return (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMember(m.user_id)}
                        className={cn(
                          "flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm text-left transition-colors",
                          selected
                            ? "border-primary/30 bg-primary/5 text-foreground"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {selected ? "✓" : ""}
                        </span>
                        <span className="flex-1 truncate">{name}</span>
                        {splitMode === "equal" && selected && perPerson > 0 && (
                          <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                            {fmt(perPerson, currency)}
                          </span>
                        )}
                      </button>

                      {splitMode === "custom" && selected && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customAmounts[m.user_id] ?? ""}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [m.user_id]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="h-9 w-24 text-sm"
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {splitMode === "custom" && totalAmt > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Total: {fmt(totalAmt, currency)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      customBalanced ? "text-emerald-600" : "text-amber-600",
                    )}
                  >
                    Allocated: {fmt(customTotal, currency)}
                    {customBalanced ? " ✓" : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 rounded-xl">
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : expense ? (
                "Save Changes"
              ) : (
                "Add Expense"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
