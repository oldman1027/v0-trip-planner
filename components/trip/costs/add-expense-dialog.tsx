"use client"

import { useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type {
  Expense,
  ExpenseCategory,
  ExpenseParticipant,
  Trip,
  MemberWithProfile,
} from "@/lib/types"

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "accommodation", label: "Accommodation" },
  { value: "transport",     label: "Transport" },
  { value: "food",          label: "Dining" },
  { value: "activities",    label: "Activities" },
  { value: "other",         label: "Other" },
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
  participants,
  currentUserId,
  onClose,
  onSave,
}: {
  open: boolean
  expense: Expense | null
  trip: Trip
  members: MemberWithProfile[]
  participants: ExpenseParticipant[]
  currentUserId: string
  onClose: () => void
  onSave: (input: {
    id?: string
    description: string
    amount: number
    currency: string
    category: ExpenseCategory
    date: string
    paid_by_user_id: string | null
    paid_by_participant_id?: string | null
    splits: { user_id: string; amount: number }[]
    participant_splits?: { participant_id: string; amount: number }[]
  }) => Promise<void>
}) {
  const currency = trip.default_currency ?? "USD"
  const usingParticipants = participants.length > 0
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  // ── Shared state ─────────────────────────────────────────────────────────
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("other")
  const [date, setDate] = useState(trip.start_date)
  const [splitMode, setSplitMode] = useState<SplitMode>("equal")
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // ── Auth-user mode state ──────────────────────────────────────────────────
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.user_id)),
  )

  // ── Participant mode state ────────────────────────────────────────────────
  const [paidByParticipantId, setPaidByParticipantId] = useState(
    participants[0]?.id ?? "",
  )
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    new Set(participants.map((p) => p.id)),
  )

  // ── Load existing expense ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    if (expense) {
      setDescription(expense.description)
      setAmount(String(expense.amount))
      setCategory(expense.category)
      setDate(expense.date)

      const splits = expense.splits ?? []
      const hasParticipantSplits = splits.some((s) => s.participant_id)

      if (hasParticipantSplits) {
        setPaidByParticipantId(expense.paid_by_participant_id ?? participants[0]?.id ?? "")
        if (splits.length === 0) {
          setSplitMode("none")
          setSelectedParticipants(new Set(participants.map((p) => p.id)))
          setCustomAmounts({})
        } else {
          const equalAmt = expense.amount / splits.length
          const isEqual = splits.every((s) => Math.abs(s.amount - equalAmt) < 0.02)
          setSplitMode(isEqual ? "equal" : "custom")
          setSelectedParticipants(new Set(splits.map((s) => s.participant_id!)))
          const amounts: Record<string, string> = {}
          for (const s of splits) {
            if (s.participant_id) amounts[s.participant_id] = String(s.amount)
          }
          setCustomAmounts(amounts)
        }
      } else {
        setPaidBy(expense.paid_by_user_id ?? currentUserId)
        if (splits.length === 0) {
          setSplitMode("none")
          setSelectedMembers(new Set(members.map((m) => m.user_id)))
          setCustomAmounts({})
        } else {
          const equalAmt = expense.amount / splits.length
          const isEqual = splits.every((s) => Math.abs(s.amount - equalAmt) < 0.02)
          setSplitMode(isEqual ? "equal" : "custom")
          setSelectedMembers(new Set(splits.map((s) => s.user_id!)))
          const amounts: Record<string, string> = {}
          for (const s of splits) {
            if (s.user_id) amounts[s.user_id] = String(s.amount)
          }
          setCustomAmounts(amounts)
        }
      }
    } else {
      setDescription("")
      setAmount("")
      setCategory("other")
      setDate(trip.start_date)
      setPaidBy(currentUserId)
      setPaidByParticipantId(participants[0]?.id ?? "")
      setSplitMode("equal")
      setSelectedMembers(new Set(members.map((m) => m.user_id)))
      setSelectedParticipants(new Set(participants.map((p) => p.id)))
      setCustomAmounts({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────────────
  const totalAmt = parseFloat(amount) || 0

  // Auth-user mode
  const includedMembers = members.filter((m) => selectedMembers.has(m.user_id))
  const perPersonMember = includedMembers.length > 0 ? totalAmt / includedMembers.length : 0
  const customTotalMember = includedMembers.reduce(
    (s, m) => s + (parseFloat(customAmounts[m.user_id] ?? "0") || 0),
    0,
  )

  // Participant mode
  const includedParticipants = participants.filter((p) => selectedParticipants.has(p.id))
  const perPersonParticipant = includedParticipants.length > 0 ? totalAmt / includedParticipants.length : 0
  const customTotalParticipant = includedParticipants.reduce(
    (s, p) => s + (parseFloat(customAmounts[p.id] ?? "0") || 0),
    0,
  )

  const customTotal = usingParticipants ? customTotalParticipant : customTotalMember
  const customBalanced = totalAmt > 0 && Math.abs(customTotal - totalAmt) < 0.5
  const perPerson = usingParticipants ? perPersonParticipant : perPersonMember

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleParticipant(participantId: string) {
    setSelectedParticipants((prev) => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId)
      else next.add(participantId)
      return next
    })
  }

  // ── Split computation ──────────────────────────────────────────────────────
  function computeMemberSplits(): { user_id: string; amount: number }[] {
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

  function computeParticipantSplits(): { participant_id: string; amount: number }[] {
    if (splitMode === "none" || includedParticipants.length === 0) return []
    if (splitMode === "equal") {
      const each = Math.round((totalAmt / includedParticipants.length) * 100) / 100
      return includedParticipants.map((p) => ({ participant_id: p.id, amount: each }))
    }
    return includedParticipants
      .map((p) => ({
        participant_id: p.id,
        amount: Math.round((parseFloat(customAmounts[p.id] ?? "0") || 0) * 100) / 100,
      }))
      .filter((s) => s.amount > 0)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
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
        paid_by_user_id:        usingParticipants ? null : paidBy,
        paid_by_participant_id: usingParticipants ? paidByParticipantId : null,
        splits:                 usingParticipants ? [] : computeMemberSplits(),
        participant_splits:     usingParticipants ? computeParticipantSplits() : undefined,
      })
    } catch {
      toast.error("Could not save expense")
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 pb-4 pt-6">
          <SheetTitle className="font-serif text-2xl">
            {expense ? "Edit Expense" : "Add Expense"}
          </SheetTitle>
        </SheetHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 pb-8 pt-6">
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
                    "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                    category === cat.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat.label}
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
              {usingParticipants
                ? participants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaidByParticipantId(p.id)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                        paidByParticipantId === p.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.name}
                    </button>
                  ))
                : members.map((m) => {
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
                  { value: "none"   as SplitMode, label: "No split"    },
                  { value: "equal"  as SplitMode, label: "Equal split" },
                  { value: "custom" as SplitMode, label: "Custom"      },
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
          {splitMode !== "none" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {splitMode === "equal"
                  ? `Who's included${perPerson > 0 ? ` · ${fmt(perPerson, currency)} each` : ""}`
                  : "Custom amounts"}
              </label>

              {usingParticipants ? (
                /* Participant-based split */
                <div className="flex flex-col gap-2">
                  {participants.map((p) => {
                    const selected = selectedParticipants.has(p.id)
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleParticipant(p.id)}
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
                          <span className="flex-1 truncate">{p.name}</span>
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
                            value={customAmounts[p.id] ?? ""}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="0.00"
                            className="h-9 w-24 text-sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Auth-user-based split */
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
                              setCustomAmounts((prev) => ({ ...prev, [m.user_id]: e.target.value }))
                            }
                            placeholder="0.00"
                            className="h-9 w-24 text-sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {splitMode === "custom" && totalAmt > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Total: {fmt(totalAmt, currency)}
                  </span>
                  <span className={cn("font-medium", customBalanced ? "text-emerald-600" : "text-amber-600")}>
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
