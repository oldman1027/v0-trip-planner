"use client"

import { useEffect, useState } from "react"
import { Trash2, Lock } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { LocationAutocomplete } from "@/components/trip/itinerary/location-autocomplete"
import type { Booking } from "@/lib/types"
import { formatDayLabel } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function BookingDrawer({
  open,
  booking,
  currency,
  tripStart,
  tripEnd,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  booking: Booking | null
  currency: string
  tripStart: string
  tripEnd: string
  onClose: () => void
  onSave: (input: Omit<Booking, "id" | "trip_id" | "created_at"> & { id?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [type, setType] = useState<Booking["type"]>("hotel")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<Booking["payment_status"]>("pending")
  const [deadline, setDeadline] = useState("")
  const [bookingDate, setBookingDate] = useState("")
  // restaurant-specific
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantDatetime, setRestaurantDatetime] = useState("")
  const [partySize, setPartySize] = useState("")
  const [restaurantLocation, setRestaurantLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (booking) {
      setType(booking.type)
      setAmount(booking.amount != null ? String(booking.amount) : "")
      setStatus(booking.payment_status)
      setDeadline(booking.cancellation_deadline ? booking.cancellation_deadline.slice(0, 10) : "")
      if (booking.type === "restaurant") {
        const d = (booking.details ?? {}) as Record<string, unknown>
        setRestaurantName((d.restaurant_name as string) ?? booking.title ?? "")
        setRestaurantDatetime((d.datetime as string) ?? "")
        setPartySize(d.party_size != null ? String(d.party_size) : "")
        setRestaurantLocation((d.location as string) ?? "")
        setTitle("")
      } else {
        setTitle(booking.title)
        setRestaurantName("")
        setRestaurantDatetime("")
        setPartySize("")
        setRestaurantLocation("")
      }
      setBookingDate(booking.booking_date ?? "")
    } else {
      setType("hotel")
      setTitle("")
      setRestaurantName("")
      setRestaurantDatetime("")
      setPartySize("")
      setRestaurantLocation("")
      setAmount("")
      setStatus("pending")
      setDeadline("")
      setBookingDate("")
    }
  }, [booking, open])

  const isRestaurant = type === "restaurant"
  // True when this booking is linked to an itinerary activity (date is auto-managed).
  const isLinked = !!(booking?.details as Record<string, unknown> | null)?.activity_id

  // Determine which date to validate against the trip range.
  const effectiveDateForValidation = isRestaurant
    ? restaurantDatetime ? restaurantDatetime.slice(0, 10) : null
    : isLinked
      ? null // trigger auto-corrects; no client error shown
      : bookingDate || null

  const dateError =
    effectiveDateForValidation && tripStart && tripEnd
      ? effectiveDateForValidation < tripStart || effectiveDateForValidation > tripEnd
        ? "Booking date must be within trip dates"
        : null
      : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const effectiveTitle = isRestaurant ? restaurantName.trim() : title.trim()
    const effectiveDetails: Record<string, unknown> | null = isRestaurant
      ? {
          restaurant_name: restaurantName.trim(),
          datetime: restaurantDatetime,
          party_size: partySize ? Number(partySize) : null,
          location: restaurantLocation.trim() || null,
          activity_id: ((booking?.details as Record<string, unknown> | null)?.activity_id as string) ?? undefined,
        }
      : booking?.details ?? null
    // Compute the booking_date to persist.
    const effectiveBookingDate: string | null = isRestaurant
      ? restaurantDatetime ? restaurantDatetime.slice(0, 10) : null
      : isLinked
        ? booking?.booking_date ?? null  // trigger will auto-correct
        : bookingDate || null
    try {
      await onSave({
        id: booking?.id,
        type,
        title: effectiveTitle,
        details: effectiveDetails,
        amount: amount ? Number(amount) : null,
        currency: booking?.currency ?? currency,
        payment_status: status,
        cancellation_deadline: deadline ? new Date(deadline + "T23:59:00").toISOString() : null,
        booking_date: effectiveBookingDate,
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

  const submitDisabled =
    saving ||
    !!dateError ||
    (isRestaurant
      ? !restaurantName.trim() || !restaurantDatetime || !partySize
      : !title.trim())

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
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    const next = v as Booking["type"]
                    setType(next)
                    // Reset status when crossing the restaurant/non-restaurant boundary
                    const isNextRestaurant = next === "restaurant"
                    const isCurRestaurant = type === "restaurant"
                    if (isNextRestaurant !== isCurRestaurant) setStatus("pending")
                  }}
                >
                  <SelectTrigger id="type" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="flight">Flight</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="restaurant">Restaurant / Meal</SelectItem>
                    <SelectItem value="experience">Experience</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {isRestaurant ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="restaurant-name">Restaurant name</FieldLabel>
                    <Input
                      id="restaurant-name"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Sukiyabashi Jiro"
                      className="rounded-xl"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="restaurant-datetime">Date &amp; time</FieldLabel>
                      <Input
                        id="restaurant-datetime"
                        type="datetime-local"
                        required
                        min={tripStart ? `${tripStart}T00:00` : undefined}
                        max={tripEnd ? `${tripEnd}T23:59` : undefined}
                        value={restaurantDatetime}
                        onChange={(e) => setRestaurantDatetime(e.target.value)}
                        className={cn("rounded-xl", dateError && "border-destructive")}
                      />
                      {dateError && (
                        <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="party-size">Party size</FieldLabel>
                      <Input
                        id="party-size"
                        type="number"
                        required
                        min="1"
                        step="1"
                        value={partySize}
                        onChange={(e) => setPartySize(e.target.value)}
                        placeholder="2"
                        className="rounded-xl"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="restaurant-location">Location (optional)</FieldLabel>
                    <LocationAutocomplete
                      id="restaurant-location"
                      value={restaurantLocation}
                      onChange={setRestaurantLocation}
                      placeholder="Restaurant address"
                    />
                  </Field>
                </>
              ) : (
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
              )}

              {/* Date field — linked bookings: read-only notice; standalone: optional date input */}
              {!isRestaurant && (
                isLinked ? (
                  booking?.booking_date ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Date follows activity · {formatDayLabel(booking.booking_date)}
                    </div>
                  ) : null
                ) : (
                  <Field>
                    <FieldLabel htmlFor="booking-date">Date (optional)</FieldLabel>
                    <Input
                      id="booking-date"
                      type="date"
                      min={tripStart || undefined}
                      max={tripEnd || undefined}
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className={cn("rounded-xl", dateError && "border-destructive")}
                    />
                    {dateError && (
                      <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>
                    )}
                  </Field>
                )
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="amount">Amount ({currency})</FieldLabel>
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
                  <FieldLabel htmlFor="status">{isRestaurant ? "Reservation" : "Payment"}</FieldLabel>
                  <Select value={status} onValueChange={(v) => setStatus(v as Booking["payment_status"])}>
                    <SelectTrigger id="status" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isRestaurant ? (
                        <>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

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
              <Button type="submit" className="rounded-xl" disabled={submitDisabled}>
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
