"use client"

import React, { useState } from "react"
import { Trash2, Pencil, ChevronDown, ChevronUp, Hotel, Plane, UtensilsCrossed, Target, Package } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Expense, ExpenseParticipant, MemberWithProfile } from "@/lib/types"

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
  onEdit,
  onDelete,
  onMarkSplitPaid,
}: {
  expense: Expense
  members: MemberWithProfile[]
  participants: ExpenseParticipant[]
  currency: string
  onEdit: () => void
  onDelete: () => void
  onMarkSplitPaid: (splitId: string, paid: boolean) => void
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
        </div>

        {/* Amount + controls */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-sm font-semibold">
            {fmt(expense.amount, displayCurrency)}
          </span>

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

export function ExpenseList({
  expenses,
  members,
  participants,
  currency,
  onEdit,
  onDelete,
  onMarkSplitPaid,
}: {
  expenses: Expense[]
  members: MemberWithProfile[]
  participants: ExpenseParticipant[]
  currency: string
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
  onMarkSplitPaid: (splitId: string, paid: boolean) => void
}) {
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

  const totalsByCurrency = expenses.reduce((acc, e) => {
    const cur = e.currency || currency
    acc[cur] = (acc[cur] ?? 0) + e.amount
    return acc
  }, {} as Record<string, number>)
  const totalEntries = Object.entries(totalsByCurrency).filter(([, v]) => v > 0)

  const dateGroups = Array.from(
    expenses.reduce((acc, e) => {
      const arr = acc.get(e.date) ?? []
      arr.push(e)
      acc.set(e.date, arr)
      return acc
    }, new Map<string, Expense[]>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, expenses: items }))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-sm text-muted-foreground">
          {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
        </span>
        <span className="tabular-nums text-sm font-semibold">
          {totalEntries.map(([cur, amt], i) => (
            <span key={cur}>
              {i > 0 && <span className="mx-1.5 text-muted-foreground">·</span>}
              {fmt(amt, cur)}
            </span>
          ))}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {dateGroups.map((group) => (
          <section
            key={group.date}
            id={`expense-group-${group.date}`}
            className="rounded-2xl transition-shadow"
          >
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              {formatDateLabel(group.date)}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {group.expenses.map((e) => (
                  <ExpenseItem
                    key={e.id}
                    expense={e}
                    members={members}
                    participants={participants}
                    currency={currency}
                    onEdit={() => onEdit(e)}
                    onDelete={() => onDelete(e.id)}
                    onMarkSplitPaid={onMarkSplitPaid}
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
