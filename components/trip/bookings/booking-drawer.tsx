"use client"

import { useEffect, useRef, useState } from "react"
import { Trash2, Lock, ExternalLink, Paperclip } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { LocationAutocomplete } from "@/components/trip/itinerary/location-autocomplete"
import type { Booking, BookingAttachment } from "@/lib/types"
import { BookingAttachments, PendingAttachments } from "./booking-attachments"
import { uploadBookingAttachment } from "@/lib/supabase/booking-attachments"
import { formatDayLabel } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type DrawerType = "accommodation" | "transport" | "dining" | "activities" | "other"

export type BookingSaveInput = Omit<Booking, "id" | "trip_id" | "created_at"> & {
  id?: string
  trackInCosts?: boolean
  addToItinerary?: boolean
}

export function BookingDrawer({
  open,
  booking,
  tripId,
  currency,
  tripStart,
  tripEnd,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  booking: Booking | null
  tripId: string
  currency: string
  tripStart: string
  tripEnd: string
  onClose: () => void
  onSave: (input: BookingSaveInput) => Promise<string | undefined>
  onDelete: (id: string) => Promise<void>
}) {
  const [type, setType] = useState<DrawerType>("accommodation")
  const [title, setTitle] = useState("")
  const [bookingDate, setBookingDate] = useState("")
  // transport
  const [transportFrom, setTransportFrom] = useState("")
  const [transportTo, setTransportTo] = useState("")
  const [transportDeparture, setTransportDeparture] = useState("")
  const [transportArrival, setTransportArrival] = useState("")
  // accommodation
  const [checkInTime, setCheckInTime] = useState("")
  const [checkOutTime, setCheckOutTime] = useState("")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [address, setAddress] = useState("")
  // dining
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantDatetime, setRestaurantDatetime] = useState("")
  const [partySize, setPartySize] = useState("")
  const [restaurantLocation, setRestaurantLocation] = useState("")
  // activities
  const [startTime, setStartTime] = useState("")
  const [activityLocation, setActivityLocation] = useState("")
  // all types
  const [confirmationNumber, setConfirmationNumber] = useState("")
  const [bookingUrl, setBookingUrl] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<Booking["payment_status"]>("pending")
  const [reservationStatus, setReservationStatus] = useState<"confirmed" | "pending" | "tbc" | "cancelled">("tbc")
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [trackInCosts, setTrackInCosts] = useState(false)
  const [addToItinerary, setAddToItinerary] = useState(true)
  const [selectedCurrency, setSelectedCurrency] = useState<"THB" | "MYR">("THB")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle")
  const formRef = useRef<HTMLFormElement>(null)
  const saveLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevReservationStatusRef = useRef<"confirmed" | "pending" | "tbc" | "cancelled" | null>(null)

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

  useEffect(() => {
    if (saveLabelTimerRef.current) clearTimeout(saveLabelTimerRef.current)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setIsDirty(false)
    setSaveLabel("idle")

    if (booking) {
      const t = booking.type as DrawerType
      setType(t)
      setAmount(booking.amount != null ? String(booking.amount) : "")
      setStatus(booking.payment_status)
      setReservationStatus((booking.reservation_status ?? "tbc") as "confirmed" | "pending" | "tbc" | "cancelled")
      setDeadline(booking.cancellation_deadline ? booking.cancellation_deadline.slice(0, 10) : "")
      setConfirmationNumber(booking.confirmation_number ?? "")
      setBookingUrl(booking.booking_url ?? "")
      const d = (booking.details ?? {}) as Record<string, unknown>
      setNotes((d.notes as string) ?? "")

      if (t === "dining") {
        setRestaurantName((d.restaurant_name as string) ?? booking.title ?? "")
        setRestaurantDatetime((d.datetime as string) ?? "")
        setPartySize(d.party_size != null ? String(d.party_size) : "")
        setRestaurantLocation((d.location as string) ?? "")
        setTitle("")
        setBookingDate("")
        setCheckInTime("")
        setCheckOutTime("")
        setAddress("")
        setStartTime("")
        setActivityLocation("")
      } else if (t === "accommodation") {
        setTitle(booking.title)
        setBookingDate(booking.booking_date ?? "")
        setCheckOutDate(booking.check_out_date ?? "")
        setCheckInTime(booking.check_in_time ?? "")
        setCheckOutTime(booking.check_out_time ?? "")
        setAddress((d.address as string) ?? "")
        setRestaurantName("")
        setRestaurantDatetime("")
        setPartySize("")
        setRestaurantLocation("")
        setStartTime("")
        setActivityLocation("")
      } else if (t === "activities") {
        setTitle(booking.title)
        setBookingDate(booking.booking_date ?? "")
        setStartTime(booking.departure_time ?? "")
        setActivityLocation((d.location as string) ?? "")
        setAddress("")
        setCheckInTime("")
        setCheckOutTime("")
        setRestaurantName("")
        setRestaurantDatetime("")
        setPartySize("")
        setRestaurantLocation("")
      } else if (t === "transport") {
        setTitle(booking.title)
        setBookingDate("")
        const d2 = (booking.details ?? {}) as Record<string, unknown>
        setTransportFrom((d2.from_city as string) ?? "")
        setTransportTo((d2.to_city as string) ?? "")
        setTransportDeparture(toDatetimeLocal((d2.departure_time as string) ?? ""))
        setTransportArrival(toDatetimeLocal((d2.arrival_time as string) ?? ""))
        setAddress("")
        setCheckInTime("")
        setCheckOutTime("")
        setStartTime("")
        setActivityLocation("")
        setRestaurantName("")
        setRestaurantDatetime("")
        setPartySize("")
        setRestaurantLocation("")
      } else {
        setTitle(booking.title)
        setBookingDate(booking.booking_date ?? "")
        setAddress("")
        setCheckInTime("")
        setCheckOutTime("")
        setStartTime("")
        setActivityLocation("")
        setRestaurantName("")
        setRestaurantDatetime("")
        setPartySize("")
        setRestaurantLocation("")
      }
      setTrackInCosts(false)
      setAddToItinerary(false)
    } else {
      setType("accommodation")
      setTitle("")
      setBookingDate("")
      setTransportFrom("")
      setTransportTo("")
      setTransportDeparture("")
      setTransportArrival("")
      setCheckInTime("")
      setCheckOutTime("")
      setCheckOutDate("")
      setAddress("")
      setRestaurantName("")
      setRestaurantDatetime("")
      setPartySize("")
      setRestaurantLocation("")
      setStartTime("")
      setActivityLocation("")
      setConfirmationNumber("")
      setBookingUrl("")
      setAmount("")
      setStatus("pending")
      setReservationStatus("tbc")
      setDeadline("")
      setNotes("")
      setTrackInCosts(false)
      setAddToItinerary(true)
      setSelectedCurrency("THB")
      setPendingFiles([])
    }
  }, [booking?.id, open])

  const isDining = type === "dining"
  const isAccommodation = type === "accommodation"
  const isTransport = type === "transport"
  const isLinked = !!(booking?.details as Record<string, unknown> | null)?.activity_id

  const effectiveDateForValidation = isDining
    ? restaurantDatetime ? restaurantDatetime.slice(0, 10) : null
    : isLinked ? null
    : bookingDate || null

  const dateError =
    effectiveDateForValidation && tripStart && tripEnd
      ? effectiveDateForValidation < tripStart || effectiveDateForValidation > tripEnd
        ? "Booking date must be within trip dates"
        : null
      : null

  function toDatetimeLocal(dt: string | undefined): string {
    if (!dt) return ""
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)) return dt
    if (dt.includes("T")) return dt.slice(0, 16)
    return ""
  }

  function calcDuration(dep: string, arr: string): string {
    if (!dep || !arr) return ""
    const diff = new Date(arr).getTime() - new Date(dep).getTime()
    if (diff <= 0) return ""
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    if (h > 0 && m > 0) return `${h}h ${m}m`
    return h > 0 ? `${h}h` : `${m}m`
  }

  function convertToTHB(value: string): number | null {
    if (!value) return null
    const num = Number(value)
    return selectedCurrency === "MYR" ? num * 7.69 : num
  }

  function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + "T00:00:00")
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  function calcNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0
    return Math.round(
      (new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) / 86_400_000,
    )
  }

  function buildSaveInput(): BookingSaveInput {
    const existingActivityId = ((booking?.details as Record<string, unknown> | null)?.activity_id as string) ?? undefined
    let effectiveTitle: string
    let effectiveDetails: Record<string, unknown> | null
    let effectiveBookingDate: string | null
    let effectiveCheckInTime: string | null = null
    let effectiveCheckOutTime: string | null = null
    let effectiveCheckOutDate: string | null = null
    let effectiveDepartureTime: string | null = null
    let effectiveArrivalTime: string | null = null

    if (type === "dining") {
      effectiveTitle = restaurantName.trim()
      effectiveDetails = {
        restaurant_name: restaurantName.trim(),
        datetime: restaurantDatetime,
        party_size: partySize ? Number(partySize) : null,
        location: restaurantLocation.trim() || null,
        activity_id: existingActivityId,
        notes: notes.trim() || null,
      }
      effectiveBookingDate = restaurantDatetime ? restaurantDatetime.slice(0, 10) : null
    } else if (type === "accommodation") {
      effectiveTitle = title.trim()
      effectiveDetails = { address: address.trim() || null, notes: notes.trim() || null }
      effectiveBookingDate = isLinked ? (booking?.booking_date ?? null) : bookingDate || null
      effectiveCheckInTime = checkInTime || null
      effectiveCheckOutTime = checkOutTime || null
      effectiveCheckOutDate = checkOutDate || null
    } else if (type === "activities") {
      effectiveTitle = title.trim()
      effectiveDetails = { location: activityLocation.trim() || null, notes: notes.trim() || null }
      effectiveBookingDate = bookingDate || null
      effectiveDepartureTime = startTime || null
    } else if (type === "transport") {
      effectiveTitle = title.trim() || "Transport"
      effectiveDetails = {
        transport_type: "transport",
        from_city: transportFrom.trim() || null,
        to_city: transportTo.trim() || null,
        departure_time: transportDeparture || null,
        arrival_time: transportArrival || null,
        notes: notes.trim() || null,
      }
      effectiveBookingDate = transportDeparture ? transportDeparture.slice(0, 10) : null
      effectiveDepartureTime = transportDeparture ? transportDeparture.slice(11, 16) : null
      effectiveArrivalTime = transportArrival ? transportArrival.slice(11, 16) : null
    } else {
      effectiveTitle = title.trim()
      effectiveDetails = notes.trim() ? { notes: notes.trim() } : null
      effectiveBookingDate = bookingDate || null
    }

    return {
      id: booking?.id,
      type,
      title: effectiveTitle,
      details: effectiveDetails,
      amount: convertToTHB(amount),
      currency: booking?.currency ?? currency,
      payment_status: status,
      reservation_status: reservationStatus,
      cancellation_deadline: deadline ? new Date(deadline + "T23:59:00").toISOString() : null,
      booking_date: effectiveBookingDate,
      confirmation_number: confirmationNumber.trim() || null,
      booking_url: bookingUrl.trim() || null,
      check_in_time: effectiveCheckInTime,
      check_out_time: effectiveCheckOutTime,
      check_out_date: effectiveCheckOutDate,
      departure_time: effectiveDepartureTime,
      arrival_time: effectiveArrivalTime,
      trackInCosts: !booking && trackInCosts,
      addToItinerary: !booking && addToItinerary,
    }
  }

  async function saveBooking(): Promise<boolean> {
    setSaving(true)
    setSaveLabel("saving")
    try {
      await onSave(buildSaveInput())
      setIsDirty(false)
      setSaveLabel("saved")
      saveLabelTimerRef.current = setTimeout(() => setSaveLabel("idle"), 1500)
      return true
    } catch (err) {
      const e = err as { message?: string; details?: string }
      toast.error("Could not save booking", {
        description: e?.message ?? e?.details ?? JSON.stringify(err),
      })
      setSaveLabel("idle")
      return false
    } finally {
      setSaving(false)
    }
  }

  function handleSheetOpenChange(v: boolean) {
    if (!v) {
      if (booking && isDirty) {
        saveBooking().then(() => onClose())
      } else {
        onClose()
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (booking) {
      await saveBooking()
      return
    }
    setSaving(true)
    try {
      const newId = await onSave(buildSaveInput())
      if (newId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try { await uploadBookingAttachment(newId, tripId, file) } catch { /* ignore per-file errors */ }
        }
      }
      onClose()
    } catch (err) {
      const e = err as { message?: string; details?: string }
      toast.error("Could not save booking", {
        description: e?.message ?? e?.details ?? JSON.stringify(err),
      })
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
    (!!booking && !isDirty) ||
    (isDining
      ? !restaurantName.trim() || !restaurantDatetime || !partySize
      : isTransport
      ? false
      : !title.trim())

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="font-serif text-2xl">{booking ? "Edit booking" : "Add booking"}</SheetTitle>
          {isLinked && booking && (
            <p className="mt-1 text-xs text-muted-foreground">
              🔗 Linked to activity: <span className="font-medium text-foreground">{booking.title}</span>
              <span className="mt-0.5 block text-muted-foreground/70">
                Date, time and location sync automatically from the activity.
              </span>
            </p>
          )}
        </SheetHeader>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          onChange={() => setIsDirty(true)}
          onBlur={() => {
            if (!booking || !isDirty) return
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
            autoSaveTimerRef.current = setTimeout(() => saveBooking(), 800)
          }}
          className="flex flex-1 flex-col"
        >
          <div className="flex-1 px-4 py-6">
            <FieldGroup>
              {/* Type selector */}
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    const next = v as DrawerType
                    setType(next)
                    setIsDirty(true)
                    if ((next === "dining") !== isDining) setStatus("pending")
                  }}
                >
                  <SelectTrigger id="type" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accommodation">🏨 Accommodation</SelectItem>
                    <SelectItem value="transport">✈️ Transport</SelectItem>
                    <SelectItem value="dining">🍽️ Dining</SelectItem>
                    <SelectItem value="activities">🎭 Activities</SelectItem>
                    <SelectItem value="other">📦 Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* ── Accommodation fields ── */}
              {isAccommodation && (
                <>
                  <Field>
                    <FieldLabel htmlFor="title">Property name</FieldLabel>
                    <Input
                      id="title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Grand Hyatt Tokyo"
                      className="rounded-xl"
                    />
                  </Field>

                  {isLinked ? (
                    booking?.booking_date ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Date follows activity · {formatDayLabel(booking.booking_date)}
                      </div>
                    ) : null
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="booking-date">Check-in date</FieldLabel>
                          <Input
                            id="booking-date"
                            type="date"
                            min={tripStart || undefined}
                            max={tripEnd || undefined}
                            value={bookingDate}
                            onChange={(e) => {
                              const d = e.target.value
                              setBookingDate(d)
                              if (!checkOutDate && d) setCheckOutDate(addDays(d, 1))
                            }}
                            className={cn("rounded-xl", dateError && "border-destructive")}
                          />
                          {dateError && <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>}
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="check-out-date">Check-out date</FieldLabel>
                          <Input
                            id="check-out-date"
                            type="date"
                            min={bookingDate || tripStart || undefined}
                            max={tripEnd || undefined}
                            value={checkOutDate}
                            onChange={(e) => setCheckOutDate(e.target.value)}
                            className="rounded-xl"
                          />
                        </Field>
                      </div>
                      {(() => {
                        const n = calcNights(bookingDate, checkOutDate)
                        return n > 0 ? (
                          <p className="text-xs text-muted-foreground">{n} night{n !== 1 ? "s" : ""}</p>
                        ) : null
                      })()}
                    </>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="check-in-time">Check-in time</FieldLabel>
                      <Input
                        id="check-in-time"
                        type="time"
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        className="rounded-xl"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="check-out-time">Check-out time</FieldLabel>
                      <Input
                        id="check-out-time"
                        type="time"
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="address">Address (optional)</FieldLabel>
                    <LocationAutocomplete
                      id="address"
                      value={address}
                      onChange={(v) => { setAddress(v); setIsDirty(true) }}
                      placeholder="Hotel address"
                    />
                  </Field>
                </>
              )}

              {/* ── Dining fields ── */}
              {isDining && (
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
                      {dateError && <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>}
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
                      onChange={(v) => { setRestaurantLocation(v); setIsDirty(true) }}
                      placeholder="Restaurant address"
                    />
                  </Field>
                </>
              )}

              {/* ── Activities fields ── */}
              {type === "activities" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="title">Activity name</FieldLabel>
                    <Input
                      id="title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Tokyo DisneySea"
                      className="rounded-xl"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="booking-date">Date</FieldLabel>
                      <Input
                        id="booking-date"
                        type="date"
                        min={tripStart || undefined}
                        max={tripEnd || undefined}
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className={cn("rounded-xl", dateError && "border-destructive")}
                      />
                      {dateError && <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="start-time">Start time</FieldLabel>
                      <Input
                        id="start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="activity-location">Location (optional)</FieldLabel>
                    <LocationAutocomplete
                      id="activity-location"
                      value={activityLocation}
                      onChange={(v) => { setActivityLocation(v); setIsDirty(true) }}
                      placeholder="Tokyo DisneySea, Japan"
                    />
                  </Field>
                </>
              )}

              {/* ── Other fields ── */}
              {type === "other" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="title">Title</FieldLabel>
                    <Input
                      id="title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Travel insurance"
                      className="rounded-xl"
                    />
                  </Field>

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
                    {dateError && <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>}
                  </Field>
                </>
              )}

              {/* ── Transport fields ── */}
              {isTransport && (
                <>
                  <Field>
                    <FieldLabel htmlFor="transport-title">Transport name / ref (optional)</FieldLabel>
                    <Input
                      id="transport-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="AK 123 / Grab / Bus"
                      className="rounded-xl"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="transport-from">From</FieldLabel>
                      <LocationAutocomplete
                        id="transport-from"
                        value={transportFrom}
                        onChange={(v) => { setTransportFrom(v); setIsDirty(true) }}
                        placeholder="Kuala Lumpur"
                        nameOnly
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="transport-to">To</FieldLabel>
                      <LocationAutocomplete
                        id="transport-to"
                        value={transportTo}
                        onChange={(v) => { setTransportTo(v); setIsDirty(true) }}
                        placeholder="Bangkok"
                        nameOnly
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="transport-dep">Departure</FieldLabel>
                      <Input
                        id="transport-dep"
                        type="datetime-local"
                        min={tripStart ? `${tripStart}T00:00` : undefined}
                        max={tripEnd ? `${tripEnd}T23:59` : undefined}
                        value={transportDeparture}
                        onChange={(e) => setTransportDeparture(e.target.value)}
                        className="rounded-xl"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="transport-arr">Arrival</FieldLabel>
                      <Input
                        id="transport-arr"
                        type="datetime-local"
                        min={transportDeparture || (tripStart ? `${tripStart}T00:00` : undefined)}
                        max={tripEnd ? `${tripEnd}T23:59` : undefined}
                        value={transportArrival}
                        onChange={(e) => setTransportArrival(e.target.value)}
                        className="rounded-xl"
                      />
                    </Field>
                  </div>

                  {transportDeparture && transportArrival && calcDuration(transportDeparture, transportArrival) && (
                    <p className="text-xs text-muted-foreground">
                      Duration: {calcDuration(transportDeparture, transportArrival)}
                    </p>
                  )}
                </>
              )}

              {/* ── Shared: confirmation + URL ── */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="conf-number">Confirmation #</FieldLabel>
                  <Input
                    id="conf-number"
                    value={confirmationNumber}
                    onChange={(e) => {
                      const val = e.target.value
                      setConfirmationNumber(val)
                      if (val.trim()) {
                        if (reservationStatus !== "confirmed") {
                          prevReservationStatusRef.current = reservationStatus
                          setReservationStatus("confirmed")
                        }
                      } else {
                        if (reservationStatus === "confirmed" && prevReservationStatusRef.current !== null) {
                          setReservationStatus(prevReservationStatusRef.current)
                          prevReservationStatusRef.current = null
                        }
                      }
                    }}
                    placeholder="ABC123"
                    className="rounded-xl"
                  />
                  {!confirmationNumber && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Having a ref number will auto-mark this as Confirmed
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="booking-url">
                    <span className="flex items-center gap-1">
                      Booking URL <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                    </span>
                  </FieldLabel>
                  <Input
                    id="booking-url"
                    type="url"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                </Field>
              </div>

              {/* ── Shared: reservation status ── */}
              <Field>
                <FieldLabel htmlFor="reservation-status">Reservation</FieldLabel>
                <Select value={reservationStatus} onValueChange={(v) => { setReservationStatus(v as "confirmed" | "pending" | "tbc" | "cancelled"); setIsDirty(true) }}>
                  <SelectTrigger id="reservation-status" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="tbc">TBC</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* ── Shared: amount + payment (payment hidden for dining) ── */}
              <div className={cn("grid gap-4", !isDining && "sm:grid-cols-2")}>
                <Field>
                  <FieldLabel htmlFor="amount">Amount ({selectedCurrency})</FieldLabel>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="rounded-xl pr-24"
                    />
                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => { setSelectedCurrency("THB"); setIsDirty(true) }}
                        className={cn(
                          "px-2 py-1 text-xs font-medium transition-colors",
                          selectedCurrency === "THB"
                            ? "bg-[#6D8F87] text-white"
                            : "bg-card text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        THB
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedCurrency("MYR"); setIsDirty(true) }}
                        className={cn(
                          "px-2 py-1 text-xs font-medium transition-colors",
                          selectedCurrency === "MYR"
                            ? "bg-[#6D8F87] text-white"
                            : "bg-card text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        MYR
                      </button>
                    </div>
                  </div>
                  {amount && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedCurrency === "THB"
                        ? `≈ MYR ${(Number(amount) * 0.13).toFixed(2)}`
                        : `≈ THB ${(Number(amount) * 7.69).toFixed(0)}`}
                    </p>
                  )}
                </Field>
                {!isDining && (
                  <Field>
                    <FieldLabel htmlFor="payment-status">Payment</FieldLabel>
                    <Select value={status} onValueChange={(v) => { setStatus(v as Booking["payment_status"]); setIsDirty(true) }}>
                      <SelectTrigger id="payment-status" className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>

              {/* ── Cancel by (not for dining) ── */}
              {!isDining && (
                <Field>
                  <FieldLabel htmlFor="deadline">Cancel by (optional)</FieldLabel>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              )}

              {/* ── Notes ── */}
              <Field>
                <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  className="min-h-[80px] rounded-xl resize-none"
                />
              </Field>

              {/* ── Attachments ── */}
              <div className="space-y-2 border-t border-border pt-4">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  Attachments
                </p>
                {booking ? (
                  <BookingAttachments
                    bookingId={booking.id}
                    tripId={tripId}
                    initialAttachments={booking.booking_attachments ?? []}
                  />
                ) : (
                  <PendingAttachments files={pendingFiles} onChange={setPendingFiles} />
                )}
              </div>

              {/* ── Add to itinerary (new bookings only) ── */}
              {!booking && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#A9D6C5]/60 bg-[#A9D6C5]/10 px-4 py-3">
                  <Checkbox
                    id="add-itinerary"
                    checked={addToItinerary}
                    onCheckedChange={(v) => setAddToItinerary(!!v)}
                    className="border-[#6D8F87] data-[state=checked]:bg-[#6D8F87] data-[state=checked]:border-[#6D8F87]"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Add to itinerary</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Create a matching activity on the itinerary board</p>
                  </div>
                </label>
              )}

              {/* ── Track in Costs (new bookings only) ── */}
              {!booking && amount && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#A9D6C5]/60 bg-[#A9D6C5]/10 px-4 py-3">
                  <Checkbox
                    id="track-costs"
                    checked={trackInCosts}
                    onCheckedChange={(v) => setTrackInCosts(!!v)}
                    className="border-[#6D8F87] data-[state=checked]:bg-[#6D8F87] data-[state=checked]:border-[#6D8F87]"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Track in Costs</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Auto-create a linked expense for this booking</p>
                  </div>
                </label>
              )}
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
              <Button
                type="submit"
                className="rounded-xl bg-[#6D8F87] text-white hover:bg-[#5A7870]"
                disabled={submitDisabled}
              >
                {saving ? (
                  <><Spinner className="mr-2 size-4" /> Saving...</>
                ) : saveLabel === "saved" ? (
                  "Saved ✓"
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
