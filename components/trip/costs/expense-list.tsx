"use client"

import React, { useEffect, useRef, useState } from "react"
import { Trash2, Pencil, ChevronDown, ChevronUp, Hotel, Plane, UtensilsCrossed, Target, Package, Lock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { groupTotal } from "@/lib/expense-utils"
import type { Expense, ExpenseParticipant, ExpenseStatus, MemberWithProfile } from "@/lib/types"

const STATUS_META: Record<ExpenseStatus, { label: string; icon: string; bg: string; text: string }> = {
  paid:      { label: "Paid",    icon: "✓", bg: "#DCFCE7", text: "#16A34A" },
  estimated: { label: "Est.",    icon: "~", bg: "#FEF9C3", text: "#CA8A04" },
  pending:   { label: "Pending", icon: "?", bg: "#F1F5F9", text: "#64748B" },
}
const STATUS_CYCLE: ExpenseStatus[] = ["paid", "estimated", "pending"]
const STATUS_ORDER: ExpenseStatus[] = ["paid", "estimated", "pending"]

function StatusBadge({
  expense,
  onStatusChange,
}: {
  expense: Expense
  onStatusChange: (id: string, status: ExpenseStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isLocked = !!expense.booking_id
  const status: ExpenseStatus = expense.status ?? (isLocked ? "paid" : "estimated")
  const meta = STATUS_META[status]

  if (isLocked) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: meta.bg, color: meta.text }}
        title="Booking expenses are always paid"
      >
        <Lock className="h-2.5 w-2.5" />
        {meta.label}
      </span>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
        style={{ background: meta.bg, color: meta.text }}
      >
        {meta.icon} {meta.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-50 mt-1 min-w-[120px] overflow-hidden rounded-xl py-1 shadow-xl"
            style={{ background: "#FDFAF6", border: "0.5px solid #D4C9BC" }}
          >
            {STATUS_CYCLE.map((s) => {
              const m = STATUS_META[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    onStatusChange(expense.id, s)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] transition-colors hover:bg-black/[0.04]"
                  style={{ color: s === status ? m.text : "#6D8F87", fontWeight: s === status ? 600 : 400 }}
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: m.bg, color: m.text }}
                  >
                    {m.icon}
                  </span>
                  {m.label === "Est." ? "Estimated" : m.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const CATEGORY_META: Record<string, { icon: React.ReactNode; label: string }> = {
  accommodation: { icon: <Hotel className="h-5 w-5" />, label: "Accommodation" },
  transport:     { icon: <Plane className="h-5 w-5" />, label: "Transport" },
  food:          { icon: <UtensilsCrossed className="h-5 w-5" />, label: "Food" },
  activities:    { icon: <Target className="h-5 w-5" />, label: "Activities" },
  other:         { icon: <Package className="h-5 w-5" />, label: "Other" },
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  const month = date.toLocaleString("en-US", { month: "short" })
  const weekday = date.toLocaleString("en-US", { weekday: "long" })
  return `${month} ${d}, ${y} · ${weekday}`
}

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

function ExpenseItem({
  expense,
  members,
  participants,
  currency,
  partySize,
  onEdit,
  onDelete,
  onMarkSplitPaid,
  onStatusChange,
}: {
  expense: Expense
  members: MemberWithProfile[]
  participants: ExpenseParticipant[]
  currency: string
  partySize: number
  onEdit: () => void
  onDelete: () => void
  onMarkSplitPaid: (splitId: string, paid: boolean) => void
  onStatusChange: (id: string, status: ExpenseStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const memberMap      = new Map(members.map((m) => [m.user_id, m]))
  const participantMap = new Map(participants.map((p) => [p.id, p]))

  const payerName = expense.paid_by_participant_id
    ? (participantMap.get(expense.paid_by_participant_id)?.name ?? "Someone")
    : (memberMap.get(expense.paid_by_user_id ?? "")?.profile?.full_name ?? "Someone")
  const splits = expense.splits ?? []
  const hasSplits = splits.length > 0
  const isFromBooking = !!expense.booking_id
  const isFromActivity = !!expense.activity_id
  const isSynced = isFromBooking || isFromActivity
  const meta = CATEGORY_META[expense.category] ?? CATEGORY_META.other

  const displayCurrency = expense.currency !== currency ? expense.currency : currency
  const total = groupTotal(expense, partySize)
  const pax = expense.pax_count ?? partySize

  return (
    <li className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onEdit()
          }
        }}
        className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      >
        {/* Category icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          {meta.icon}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium leading-snug">{expense.description}</span>
            {isFromBooking && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                From booking
              </span>
            )}
            {isFromActivity && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#A9D6C5", color: "#2C4A45" }}
              >
                From itinerary
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {new Date(expense.date + "T00:00:00").toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>·</span>
            <span>
              Paid by{" "}
              <strong className="font-medium text-foreground">{payerName}</strong>
            </span>
            {hasSplits && (
              <>
                <span>·</span>
                <span>
                  {splits.length} split{splits.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            <StatusBadge expense={expense} onStatusChange={onStatusChange} />
          </div>
        </div>

        {/* Amount + controls */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <span className="tabular-nums text-sm font-semibold">
              {fmt(total, displayCurrency)}
            </span>
            {expense.is_per_pax && (
              <p className="text-[10px] tabular-nums" style={{ color: "#A9D6C5" }}>
                {fmt(expense.amount, displayCurrency)}/pax × {pax}
              </p>
            )}
          </div>

          {hasSplits && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={expanded ? "Collapse splits" : "Show splits"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={isSynced ? "Edit amount or category" : "Edit expense"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!isSynced && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              aria-label="Delete expense"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded split details */}
      {expanded && hasSplits && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="border-t border-border/50 bg-secondary/30 px-5 py-3"
        >
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Split Details
          </p>
          <div className="flex flex-col gap-2">
            {splits.map((split) => {
              const name = split.participant_id
                ? (participantMap.get(split.participant_id)?.name ?? "Unknown")
                : (memberMap.get(split.user_id ?? "")?.profile?.full_name ?? "Unknown")
              const initials = name[0]?.toUpperCase() ?? "?"
              return (
                <div key={split.id} className="flex items-center gap-3 text-sm">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="bg-border text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {fmt(split.amount, expense.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onMarkSplitPaid(split.id, !split.paid)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                      split.paid
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-amber-900/30 dark:text-amber-400",
                    )}
                  >
                    {split.paid ? "Paid ✓" : "Pending"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </li>
  )
}

// ── Group-by helpers ───────────────────────────────────────────────────────

type GroupBy = "day" | "category" | "status"

const CAT_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  transport:     "Transport",
  food:          "Dining",
  activities:    "Activities",
  other:         "Other",
}

function buildGroups(
  expenses: Expense[],
  groupBy: GroupBy,
  currency: string,
  partySize: number,
): Array<{ key: string; label: string; expenses: Expense[]; total: number }> {
  if (groupBy === "day") {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        key: date,
        label: formatDateLabel(date),
        expenses: items,
        total: items.reduce((s, e) => s + groupTotal(e, partySize), 0),
      }))
  }

  if (groupBy === "category") {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const arr = map.get(e.category) ?? []
      arr.push(e)
      map.set(e.category, arr)
    }
    return [...map.entries()]
      .map(([cat, items]) => ({
        key: cat,
        label: CAT_LABELS[cat] ?? cat,
        expenses: items,
        total: items.reduce((s, e) => s + groupTotal(e, partySize), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }

  // status
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    const s = e.status ?? (e.source_type === "booking" ? "paid" : "estimated")
    const arr = map.get(s) ?? []
    arr.push(e)
    map.set(s, arr)
  }
  return STATUS_ORDER
    .filter((s) => map.has(s))
    .map((s) => ({
      key: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      expenses: map.get(s)!,
      total: (map.get(s) ?? []).reduce((acc, e) => acc + groupTotal(e, partySize), 0),
    }))
}

// ── Public component ───────────────────────────────────────────────────────

export function ExpenseList({
  expenses,
  members,
  participants,
  currency,
  partySize,
  tripId,
  onEdit,
  onDelete,
  onMarkSplitPaid,
  onStatusChange,
}: {
  expenses: Expense[]
  members: MemberWithProfile[]
  participants: ExpenseParticipant[]
  currency: string
  partySize: number
  tripId: string
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
  onMarkSplitPaid: (splitId: string, paid: boolean) => void
  onStatusChange: (id: string, status: ExpenseStatus) => void
}) {
  const storageKey = `costs_group_by_${tripId}`
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved === "day" || saved === "category" || saved === "status") return saved
    }
    return "day"
  })

  function changeGroupBy(v: GroupBy) {
    setGroupBy(v)
    if (typeof window !== "undefined") localStorage.setItem(storageKey, v)
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Package className="h-6 w-6" />
        </div>
        <p className="font-serif text-xl">No expenses yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add an expense or sync from your bookings above.
        </p>
      </div>
    )
  }

  const grandTotal = expenses.reduce((s, e) => s + groupTotal(e, partySize), 0)

  function fmtTotal(amount: number) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
    } catch {
      return `${currency} ${Math.round(amount)}`
    }
  }

  const groups = buildGroups(expenses, groupBy, currency, partySize)

  return (
    <div className="flex flex-col gap-2">
      {/* Header row: count + total + group-by switcher */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="text-sm text-muted-foreground">
          {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          {" · "}
          <span className="font-semibold tabular-nums text-foreground">{fmtTotal(grandTotal)}</span>
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Group by:</span>
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: "#EDE8E0" }}
          >
            {(["day", "category", "status"] as GroupBy[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => changeGroupBy(v)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
                style={
                  groupBy === v
                    ? { background: "#FDFAF6", color: "#2C4A45", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                    : { color: "#9BA8A6" }
                }
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section
            key={group.key}
            id={`expense-group-${group.key}`}
            className="rounded-2xl transition-shadow"
          >
            {/* Group header */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {groupBy === "status" ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: STATUS_META[group.key as ExpenseStatus]?.bg ?? "#F1F5F9",
                      color: STATUS_META[group.key as ExpenseStatus]?.text ?? "#64748B",
                    }}
                  >
                    {STATUS_META[group.key as ExpenseStatus]?.icon} {group.label}
                  </span>
                ) : (
                  group.label
                )}
              </h3>
              <div className="flex items-center gap-1.5 text-right">
                <span className="tabular-nums text-[12px] font-medium" style={{ color: "#2C4A45" }}>
                  {fmtTotal(group.total)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  · {group.expenses.length}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {group.expenses.map((e) => (
                  <ExpenseItem
                    key={e.id}
                    expense={e}
                    members={members}
                    participants={participants}
                    currency={currency}
                    partySize={partySize}
                    onEdit={() => onEdit(e)}
                    onDelete={() => onDelete(e.id)}
                    onMarkSplitPaid={onMarkSplitPaid}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
