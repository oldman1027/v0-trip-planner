"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { DuplicatePair } from "@/lib/booking-match"

function fmt(amount: number | null, currency: string | null) {
  if (amount == null) return ""
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency ?? ""} ${Math.round(amount)}`
  }
}

function MergePairRow({
  pair,
  onMerge,
  onDismissPair,
}: {
  pair: DuplicatePair
  onMerge: (pair: DuplicatePair) => Promise<void>
  onDismissPair: (pair: DuplicatePair) => void
}) {
  const [merging, setMerging] = useState(false)

  async function handleMerge() {
    setMerging(true)
    try {
      await onMerge(pair)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div
      key={`${pair.activity.id}:${pair.booking.id}`}
      className="rounded-2xl border border-border p-4"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            From itinerary
          </p>
          <p className="truncate font-medium">{pair.activity.title}</p>
          <p className="tabular-nums text-muted-foreground">
            {fmt(pair.activity.cost_amount, pair.activity.cost_currency)}
          </p>
        </div>
        <span className="text-muted-foreground">↔</span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            From booking
          </p>
          <p className="truncate font-medium">{pair.booking.title}</p>
          <p className="tabular-nums text-muted-foreground">
            {fmt(pair.booking.amount, pair.booking.currency)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl"
          disabled={merging}
          onClick={() => onDismissPair(pair)}
        >
          Not a duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={merging}
          onClick={handleMerge}
        >
          {merging ? "Merging…" : "Merge"}
        </Button>
      </div>
    </div>
  )
}

export function DuplicateMergeDialog({
  open,
  onOpenChange,
  pairs,
  onMerge,
  onDismissPair,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pairs: DuplicatePair[]
  onMerge: (pair: DuplicatePair) => Promise<void>
  onDismissPair: (pair: DuplicatePair) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Possible duplicate costs</DialogTitle>
          <DialogDescription>
            These itinerary items and bookings look like the same real-world cost, created
            separately. Merging keeps the booking as the source of truth and removes the
            duplicate expense.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {pairs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No more duplicates to review.
            </p>
          ) : (
            pairs.map((pair) => (
              <MergePairRow
                key={`${pair.activity.id}:${pair.booking.id}`}
                pair={pair}
                onMerge={onMerge}
                onDismissPair={onDismissPair}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
