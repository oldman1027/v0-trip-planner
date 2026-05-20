"use client"

import { useEffect, useState } from "react"
import { Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BudgetCards } from "./budget-cards"
import { ExpenseList } from "./expense-list"
import { AddExpenseDialog } from "./add-expense-dialog"
import { ManageParticipantsDialog } from "./manage-participants-dialog"
import { SettlementSummary } from "./settlement-summary"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import type {
  Trip,
  Booking,
  Expense,
  ExpenseCategory,
  ExpenseSplit,
  TripBudget,
  MemberWithProfile,
  ExpenseParticipant,
} from "@/lib/types"

// ── Constants ──────────────────────────────────────────────────────────────

const BOOKING_TO_CATEGORY: Record<string, ExpenseCategory> = {
  hotel:      "accommodation",
  flight:     "transport",
  transport:  "transport",
  restaurant: "food",
  experience: "activities",
  other:      "other",
}

const ALL_CATEGORIES: Array<"all" | ExpenseCategory> = [
  "all",
  "accommodation",
  "transport",
  "food",
  "activities",
  "other",
]

const CAT_LABELS: Record<string, string> = {
  all:           "All",
  accommodation: "Accommodation",
  transport:     "Transport",
  food:          "Dining",
  activities:    "Activities",
  other:         "Other",
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Who Owes Whom (auth-user mode) ─────────────────────────────────────────

function OweSummary({
  expenses,
  members,
  currency,
}: {
  expenses: Expense[]
  members: MemberWithProfile[]
  currency: string
}) {
  const gross = new Map<string, Map<string, number>>()

  for (const expense of expenses) {
    if (!expense.paid_by_user_id) continue
    for (const split of expense.splits ?? []) {
      if (!split.user_id) continue
      if (split.paid) continue
      if (split.user_id === expense.paid_by_user_id) continue
      const ower = split.user_id
      const owee = expense.paid_by_user_id
      if (!gross.has(ower)) gross.set(ower, new Map())
      const inner = gross.get(ower)!
      inner.set(owee, (inner.get(owee) ?? 0) + split.amount)
    }
  }

  const settled: Array<{ from: string; to: string; amount: number }> = []
  const seen = new Set<string>()

  for (const [ower, oweeMap] of gross) {
    for (const [owee, amt] of oweeMap) {
      const key = `${ower}:${owee}`
      const rev  = `${owee}:${ower}`
      if (seen.has(key) || seen.has(rev)) continue
      seen.add(key)
      seen.add(rev)
      const reverse = gross.get(owee)?.get(ower) ?? 0
      const net = amt - reverse
      if (net > 0.01) settled.push({ from: ower, to: owee, amount: net })
      else if (net < -0.01) settled.push({ from: owee, to: ower, amount: -net })
    }
  }

  if (!settled.length) return null

  const nameOf = (id: string) =>
    members.find((m) => m.user_id === id)?.profile?.full_name ?? "Someone"

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-serif text-lg">Who Owes Whom</h3>
      <div className="flex flex-col gap-2.5">
        {settled.map(({ from, to, amount }, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-2.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{nameOf(from)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{nameOf(to)}</span>
            </div>
            <span
              className="tabular-nums text-sm font-semibold"
              style={{ color: "#de4a66" }}
            >
              {fmt(amount, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main client ────────────────────────────────────────────────────────────

export function CostsClient({
  trip,
  initialExpenses,
  initialBudgets,
  members,
  initialBookings,
  currentUserId,
  initialParticipants,
}: {
  trip: Trip
  initialExpenses: Expense[]
  initialBudgets: TripBudget[]
  members: MemberWithProfile[]
  initialBookings: Booking[]
  currentUserId: string
  initialParticipants: ExpenseParticipant[]
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [budgets, setBudgets] = useState<TripBudget[]>(initialBudgets)
  const [participants, setParticipants] = useState<ExpenseParticipant[]>(initialParticipants)
  const [catFilter, setCatFilter] = useState<"all" | ExpenseCategory>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [manageMembersOpen, setManageMembersOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const currency = trip.default_currency ?? "USD"
  const usingParticipants = participants.length > 0

  useKeyboardShortcuts(
    [
      {
        key: "n",
        handler: () => {
          setEditingExpense(null)
          setDialogOpen(true)
        },
      },
    ],
    !dialogOpen && !manageMembersOpen,
  )

  // ── Auto-populate from bookings on first mount ───────────────────────────
  useEffect(() => {
    const existingBookingIds = new Set(
      initialExpenses.filter((e) => e.booking_id).map((e) => e.booking_id!),
    )
    const toCreate = initialBookings.filter(
      (b) => b.amount && b.amount > 0 && !existingBookingIds.has(b.id),
    )
    if (!toCreate.length) return
    ;(async () => {
      const supabase = createClient()
      const rows = toCreate.map((b) => ({
        trip_id:         trip.id,
        booking_id:      b.id,
        amount:          b.amount!,
        currency:        b.currency ?? currency,
        category:        BOOKING_TO_CATEGORY[b.type] ?? "other",
        date:            b.booking_date ?? trip.start_date,
        description:     b.title,
        paid_by_user_id: currentUserId,
      }))
      const { data } = await supabase
        .from("expenses")
        .insert(rows)
        .select("*, splits:expense_splits(*)")
      if (data?.length) {
        setExpenses((prev) => [...prev, ...(data as Expense[])])
        toast.success(`${data.length} booking${data.length > 1 ? "s" : ""} added as expenses`)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Expense CRUD ─────────────────────────────────────────────────────────

  async function handleSaveExpense(input: {
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
  }) {
    const supabase = createClient()
    const hasParticipantSplits = (input.participant_splits?.length ?? 0) > 0

    if (input.id) {
      const { error } = await supabase
        .from("expenses")
        .update({
          description:            input.description,
          amount:                 input.amount,
          currency:               input.currency,
          category:               input.category,
          date:                   input.date,
          paid_by_user_id:        input.paid_by_user_id ?? null,
          paid_by_participant_id: input.paid_by_participant_id ?? null,
        })
        .eq("id", input.id)
      if (error) throw error

      await supabase.from("expense_splits").delete().eq("expense_id", input.id)

      let newSplits: ExpenseSplit[] = []
      if (hasParticipantSplits) {
        const { data: sd } = await supabase
          .from("expense_splits")
          .insert(
            input.participant_splits!.map((s) => ({
              expense_id:     input.id!,
              participant_id: s.participant_id,
              user_id:        null,
              amount:         s.amount,
            })),
          )
          .select()
        newSplits = (sd ?? []) as ExpenseSplit[]
      } else if (input.splits.length) {
        const { data: sd } = await supabase
          .from("expense_splits")
          .insert(input.splits.map((s) => ({ expense_id: input.id!, ...s })))
          .select()
        newSplits = (sd ?? []) as ExpenseSplit[]
      }

      setExpenses((prev) =>
        prev.map((e) =>
          e.id === input.id ? { ...e, ...input, splits: newSplits } : e,
        ),
      )
      toast.success("Expense updated")
    } else {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          trip_id:                trip.id,
          description:            input.description,
          amount:                 input.amount,
          currency:               input.currency,
          category:               input.category,
          date:                   input.date,
          paid_by_user_id:        input.paid_by_user_id ?? null,
          paid_by_participant_id: input.paid_by_participant_id ?? null,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")

      const newExp = data as Expense
      let splits: ExpenseSplit[] = []

      if (hasParticipantSplits) {
        const { data: sd } = await supabase
          .from("expense_splits")
          .insert(
            input.participant_splits!.map((s) => ({
              expense_id:     newExp.id,
              participant_id: s.participant_id,
              user_id:        null,
              amount:         s.amount,
            })),
          )
          .select()
        splits = (sd ?? []) as ExpenseSplit[]
      } else if (input.splits.length) {
        const { data: sd } = await supabase
          .from("expense_splits")
          .insert(input.splits.map((s) => ({ expense_id: newExp.id, ...s })))
          .select()
        splits = (sd ?? []) as ExpenseSplit[]
      }

      setExpenses((prev) => [{ ...newExp, splits }, ...prev])
      toast.success("Expense added")
    }

    setDialogOpen(false)
    setEditingExpense(null)
  }

  async function handleDeleteExpense(id: string) {
    const supabase = createClient()
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    const { error } = await supabase.from("expenses").delete().eq("id", id)
    if (error) {
      setExpenses(initialExpenses)
      toast.error("Could not delete expense")
    } else {
      toast.success("Expense removed")
    }
  }

  async function handleMarkSplitPaid(splitId: string, paid: boolean) {
    const supabase = createClient()
    await supabase.from("expense_splits").update({ paid }).eq("id", splitId)
    setExpenses((prev) =>
      prev.map((e) => ({
        ...e,
        splits: e.splits?.map((s) => (s.id === splitId ? { ...s, paid } : s)),
      })),
    )
  }

  // ── Budget CRUD ───────────────────────────────────────────────────────────

  async function handleSetBudget(category: ExpenseCategory, amount: number) {
    const supabase = createClient()
    const existing = budgets.find((b) => b.category === category)

    if (existing) {
      const { error } = await supabase
        .from("trip_budgets")
        .update({ budget_amount: amount })
        .eq("id", existing.id)
      if (error) throw error
      setBudgets((prev) =>
        prev.map((b) => (b.category === category ? { ...b, budget_amount: amount } : b)),
      )
    } else {
      const { data, error } = await supabase
        .from("trip_budgets")
        .insert({ trip_id: trip.id, category, budget_amount: amount })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setBudgets((prev) => [...prev, data as TripBudget])
    }
  }

  // ── Filtered view ─────────────────────────────────────────────────────────

  const filtered =
    catFilter === "all" ? expenses : expenses.filter((e) => e.category === catFilter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Budget cards */}
      <BudgetCards
        expenses={expenses}
        budgets={budgets}
        currency={currency}
        onSetBudget={handleSetBudget}
      />

      {/* Filter bar + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                catFilter === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setManageMembersOpen(true)}
          >
            <Users className="mr-2 h-4 w-4" aria-hidden />
            Members
          </Button>
          <Button
            className="rounded-xl"
            onClick={() => {
              setEditingExpense(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Expense list */}
      <ExpenseList
        expenses={filtered}
        members={members}
        participants={participants}
        currency={currency}
        onEdit={(e) => {
          setEditingExpense(e)
          setDialogOpen(true)
        }}
        onDelete={handleDeleteExpense}
        onMarkSplitPaid={handleMarkSplitPaid}
      />

      {/* Who owes whom — participant mode vs auth-user mode */}
      {usingParticipants ? (
        <SettlementSummary
          expenses={expenses}
          participants={participants}
          currency={currency}
        />
      ) : (
        <OweSummary expenses={expenses} members={members} currency={currency} />
      )}

      {/* Add / edit dialog */}
      <AddExpenseDialog
        open={dialogOpen}
        expense={editingExpense}
        trip={trip}
        members={members}
        participants={participants}
        currentUserId={currentUserId}
        onClose={() => {
          setDialogOpen(false)
          setEditingExpense(null)
        }}
        onSave={handleSaveExpense}
        onOpenMembers={() => {
          setDialogOpen(false)
          setEditingExpense(null)
          setManageMembersOpen(true)
        }}
      />

      {/* Manage members dialog */}
      <ManageParticipantsDialog
        tripId={trip.id}
        open={manageMembersOpen}
        participants={participants}
        onOpenChange={setManageMembersOpen}
        onParticipantsChange={setParticipants}
      />
    </div>
  )
}
