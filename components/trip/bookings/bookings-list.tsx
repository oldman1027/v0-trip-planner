"use client"

import { useMemo, useState } from "react"
import { Plus, Hotel, Plane, Bus, Ticket } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { BookingDrawer } from "./booking-drawer"
import { createClient } from "@/lib/supabase/client"
import { differenceInDays } from "date-fns"
import type { Booking } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TYPE_META: Record<Booking["type"], { label: string; icon: typeof Hotel }> = {
  hotel: { label: "Hotel", icon: Hotel },
  flight: { label: "Flight", icon: Plane },
  transport: { label: "Transport", icon: Bus },
  other: { label: "Other", icon: Ticket },
}

export function BookingsList({
  tripId,
  initialBookings,
}: {
  tripId: string
  initialBookings: Booking[]
}) {
  const [bookings, setBookings] = useState(initialBookings)
  const [filter, setFilter] = useState<string>("all")
  const [open, setOpen] = useState<Booking | "new" | null>(null)

  const filtered = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((b) => b.type === filter)),
    [bookings, filter],
  )

  async function handleSave(input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }) {
    const supabase = createClient()
    if (input.id) {
      const { error } = await supabase
        .from("bookings")
        .update({
          type: input.type,
          title: input.title,
          details: input.details,
          amount: input.amount,
          currency: input.currency,
          payment_status: input.payment_status,
          cancellation_deadline: input.cancellation_deadline,
        })
        .eq("id", input.id)
      if (error) throw error
      setBookings((prev) =>
        prev.map((b) => (b.id === input.id ? ({ ...b, ...input, id: input.id! } as Booking) : b)),
      )
      toast.success("Booking updated")
    } else {
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...input, trip_id: tripId })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setBookings((prev) => [data as Booking, ...prev])
      toast.success("Booking added")
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const prev = bookings
    setBookings((p) => p.filter((b) => b.id !== id))
    const { error } = await supabase.from("bookings").delete().eq("id", id)
    if (error) {
      setBookings(prev)
      toast.error("Could not delete booking")
      throw error
    }
    toast.success("Booking removed")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1"
        >
          {[
            { v: "all", l: "All" },
            { v: "hotel", l: "Hotels" },
            { v: "flight", l: "Flights" },
            { v: "transport", l: "Transport" },
            { v: "other", l: "Other" },
          ].map((t) => (
            <ToggleGroupItem
              key={t.v}
              value={t.v}
              className="rounded-lg px-3 py-1.5 text-sm data-[state=on]:bg-secondary data-[state=on]:text-primary"
            >
              {t.l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button className="rounded-xl" onClick={() => setOpen("new")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add booking
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-primary">
              <Ticket className="h-6 w-6" aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="font-serif text-2xl">No bookings yet</EmptyTitle>
            <EmptyDescription className="max-w-md">
              Track hotels, flights, and reservations in one place — with payment status and cancellation alerts.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="rounded-2xl border-border">
          <ul className="divide-y divide-border">
            {filtered.map((b) => {
              const Icon = TYPE_META[b.type].icon
              const deadline = b.cancellation_deadline ? new Date(b.cancellation_deadline) : null
              const daysLeft = deadline ? differenceInDays(deadline, new Date()) : null
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(b)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/30"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="flex flex-1 flex-col">
                      <div className="font-medium">{b.title}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{TYPE_META[b.type].label}</span>
                        {deadline ? (
                          <span
                            className={cn(
                              "tabular",
                              daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && "font-medium text-destructive",
                            )}
                          >
                            Cancel by {deadline.toLocaleDateString()}
                            {daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.amount != null ? (
                        <span className="tabular text-sm font-medium">
                          {formatMoney(b.amount, b.currency ?? "USD")}
                        </span>
                      ) : null}
                      <PaymentBadge status={b.payment_status} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <BookingDrawer
        open={open !== null}
        booking={open === "new" ? null : open}
        onClose={() => setOpen(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}

function PaymentBadge({ status }: { status: Booking["payment_status"] }) {
  const styles =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : status === "partial"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-secondary text-primary border border-transparent"
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", styles)}>{status}</span>
  )
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
