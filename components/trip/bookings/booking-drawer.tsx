"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { Booking } from "@/lib/types"
import { toast } from "sonner"

export function BookingDrawer({
  open,
  booking,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  booking: Booking | null
  onClose: () => void
  onSave: (input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [type, setType] = useState<Booking["type"]>("hotel")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<Booking["payment_status"]>("pending")
  const [deadline, setDeadline] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (booking) {
      setType(booking.type)
      setTitle(booking.title)
      setAmount(booking.amount != null ? String(booking.amount) : "")
      setStatus(booking.payment_status)
      setDeadline(booking.cancellation_deadline ? booking.cancellation_deadline.slice(0, 10) : "")
    } else {
      setType("hotel")
      setTitle("")
      setAmount("")
      setStatus("pending")
      setDeadline("")
    }
  }, [booking, open])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        id: booking?.id,
        type,
        title: title.trim(),
        details: booking?.details ?? null,
        amount: amount ? Number(amount) : null,
        currency: booking?.currency ?? "USD",
        payment_status: status,
        cancellation_deadline: deadline ? new Date(deadline + "T23:59:00").toISOString() : null,
      })
      onClose()
    } catch (err) {
      toast.error("Could not save booking", { description: err instanceof Error ? err.message : "Unknown" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!booking) return
    setDeleting(true)
    try {
      await onDelete(booking.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-serif text-2xl">{booking ? "Edit booking" : "Add booking"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 px-4 py-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Hotel Gracery Shinjuku"
                  className="rounded-xl"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="type">Type</FieldLabel>
                  <Select value={type} onValueChange={(v) => setType(v as Booking["type"])}>
                    <SelectTrigger id="type" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="flight">Flight</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="status">Payment</FieldLabel>
                  <Select value={status} onValueChange={(v) => setStatus(v as Booking["payment_status"])}>
                    <SelectTrigger id="status" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="amount">Amount (USD)</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="rounded-xl"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="deadline">Cancel by</FieldLabel>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              </div>
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-card p-4">
            {booking ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving || !title.trim()}>
                {saving ? (
                  <>
                    <Spinner className="mr-2 size-4" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
