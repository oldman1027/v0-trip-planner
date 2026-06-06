"use client"

import { useState, useEffect, useRef } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Trash2, Pencil, Paperclip } from "lucide-react"
import { BookingAttachments, PendingAttachments } from "./booking-attachments"
import { LocationAutocomplete } from "@/components/trip/itinerary/location-autocomplete"
import { uploadBookingAttachment } from "@/lib/supabase/booking-attachments"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Booking } from "@/lib/types"
import type { BookingSaveInput } from "./booking-drawer"

type TransportDetails = {
  from_code?: string
  from_city?: string
  to_code?: string
  to_city?: string
  departure_time?: string
  arrival_time?: string
  notes?: string
}

type EditingField =
  | "flightNumber"
  | "fromCode"
  | "toCode"
  | "departureTime"
  | "arrivalTime"
  | "amount"
  | null

function toDatetimeLocal(dt: string | undefined): string {
  if (!dt) return ""
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dt)) return dt
  if (dt.includes("T")) return dt.slice(0, 16)
  return ""
}

function fmtDateTime(dt: string): string {
  if (!dt) return "—"
  const [datePart, timePart] = dt.split("T")
  if (!datePart || !timePart) return "—"
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)
  const d = new Date(year, month - 1, day, hour, minute)
  const weekday = d.toLocaleString("en-US", { weekday: "short" })
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  return `${weekday}, ${day} ${d.toLocaleString("en-US", { month: "short" })} · ${timeStr}`
}

function calcDuration(dep: string, arr: string): string {
  if (!dep || !arr) return ""
  const [dDate, dTime] = dep.split("T")
  const [aDate, aTime] = arr.split("T")
  if (!dDate || !dTime || !aDate || !aTime) return ""
  const [dy, dm, dd] = dDate.split("-").map(Number)
  const [dh, dmin] = dTime.split(":").map(Number)
  const [ay, am, ad] = aDate.split("-").map(Number)
  const [ah, amin] = aTime.split(":").map(Number)
  const diff =
    new Date(ay, am - 1, ad, ah, amin).getTime() -
    new Date(dy, dm - 1, dd, dh, dmin).getTime()
  if (diff <= 0) return ""
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  return h > 0 ? `${h}h` : `${m}m`
}

export function TransportDrawer({
  open,
  booking,
  defaultType = "transport",
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
  defaultType?: "transport" | "flight"
  tripId: string
  currency: string
  tripStart: string
  tripEnd: string
  onClose: () => void
  onSave: (input: BookingSaveInput) => Promise<string | undefined>
  onDelete: (id: string) => Promise<void>
}) {
  const [type, setType] = useState<"transport" | "flight">(defaultType)
  const [flightNumber, setFlightNumber] = useState("")
  const [fromCode, setFromCode] = useState("")
  const [fromCity, setFromCity] = useState("")
  const [toCode, setToCode] = useState("")
  const [toCity, setToCity] = useState("")
  const [departureTime, setDepartureTime] = useState("")
  const [arrivalTime, setArrivalTime] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedCurrency, setSelectedCurrency] = useState<"THB" | "MYR">("THB")
  const [paymentStatus, setPaymentStatus] = useState<Booking["payment_status"]>("pending")
  const [cancellationDeadline, setCancellationDeadline] = useState("")
  const [confirmationNumber, setConfirmationNumber] = useState("")
  const [bookingUrl, setBookingUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [addToItinerary, setAddToItinerary] = useState(true)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle")
  const saveLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveLabelTimerRef.current) clearTimeout(saveLabelTimerRef.current)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setIsDirty(false)
    setSaveLabel("idle")
    if (!open) {
      setEditingField(null)
      return
    }
    if (booking) {
      const d = (booking.details ?? {}) as TransportDetails & { transport_type?: string }
      setType(d.transport_type === "flight" ? "flight" : "transport")
      setAddToItinerary(false)
      setFlightNumber(booking.title ?? "")
      setFromCode(d.from_code ?? "")
      setFromCity(d.from_city ?? "")
      setToCode(d.to_code ?? "")
      setToCity(d.to_city ?? "")
      setDepartureTime(toDatetimeLocal(d.departure_time))
      setArrivalTime(toDatetimeLocal(d.arrival_time))
      setAmount(booking.amount != null ? String(booking.amount) : "")
      setPaymentStatus(booking.payment_status)
      setCancellationDeadline(
        booking.cancellation_deadline ? booking.cancellation_deadline.slice(0, 10) : ""
      )
      setConfirmationNumber(booking.confirmation_number ?? "")
      setBookingUrl(booking.booking_url ?? "")
      setNotes(d.notes ?? "")
    } else {
      setType(defaultType)
      setAddToItinerary(true)
      setFlightNumber("")
      setFromCode("")
      setFromCity("")
      setToCode("")
      setToCity("")
      setDepartureTime("")
      setArrivalTime("")
      setAmount("")
      setSelectedCurrency("THB")
      setPaymentStatus("pending")
      setCancellationDeadline("")
      setConfirmationNumber("")
      setBookingUrl("")
      setNotes("")
      setPendingFiles([])
    }
    setEditingField(null)
  }, [booking?.id, open, defaultType])

  const duration = calcDuration(departureTime, arrivalTime)

  function buildSaveInput(): BookingSaveInput {
    return {
      id: booking?.id,
      type: "transport",
      title: flightNumber.trim() || (type === "flight" ? "Flight" : "Transport"),
      addToItinerary: !booking && addToItinerary,
      details: {
        transport_type: type,
        from_code: fromCode.trim().toUpperCase() || null,
        from_city: fromCity.trim() || null,
        to_code: toCode.trim().toUpperCase() || null,
        to_city: toCity.trim() || null,
        departure_time: departureTime || null,
        arrival_time: arrivalTime || null,
        notes: notes.trim() || null,
      },
      confirmation_number: confirmationNumber.trim() || null,
      booking_url: bookingUrl.trim() || null,
      check_in_time: null,
      check_out_time: null,
      check_out_date: null,
      departure_time: null,
      arrival_time: null,
      amount: amount ? (selectedCurrency === "MYR" ? Number(amount) * 7.69 : Number(amount)) : null,
      currency: "THB",
      payment_status: paymentStatus,
      cancellation_deadline: cancellationDeadline
        ? new Date(cancellationDeadline + "T23:59:00").toISOString()
        : null,
      booking_date: departureTime ? departureTime.slice(0, 10) : null,
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
      toast.error("Could not save transport", {
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

  async function handleSave(e: React.FormEvent) {
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
      toast.error("Could not save transport", {
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

  function stopEdit() {
    setEditingField(null)
    if (booking && isDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => saveBooking(), 800)
    }
  }

  const routeLabel =
    fromCode && toCode ? `${fromCode.toUpperCase()} → ${toCode.toUpperCase()}` : null
  const subLabel =
    fromCity && toCity ? `${fromCity} → ${toCity}` : null

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md overflow-hidden">
        <form onSubmit={handleSave} onChange={() => setIsDirty(true)} className="flex h-full flex-col">
          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Header row — delete button (edit only) */}
            {booking && (
              <div className="flex items-center justify-end px-5 pt-5 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── Flight card ── */}
            <div className={cn("mx-5 mb-6 rounded-xl border border-border bg-card p-5 shadow-sm", !booking && "mt-5")}>
              {/* Flight / ref number */}
              {editingField === "flightNumber" ? (
                <Input
                  autoFocus
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  onBlur={stopEdit}
                  onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                  placeholder={type === "flight" ? "AK 123" : "Transport ref"}
                  className="mb-2 h-9 rounded-lg text-xl font-bold"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingField("flightNumber")}
                  className="group mb-2 flex items-center gap-1.5 text-left"
                >
                  <span className="text-2xl font-bold leading-tight">
                    {flightNumber || (
                      <span className="font-normal text-muted-foreground">
                        {type === "flight" ? "Flight number" : "Transport ref"}
                      </span>
                    )}
                  </span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
                </button>
              )}

              {/* Route codes */}
              <div className="flex items-center gap-2">
                {editingField === "fromCode" ? (
                  <Input
                    autoFocus
                    value={fromCode}
                    onChange={(e) => setFromCode(e.target.value.toUpperCase())}
                    onBlur={stopEdit}
                    onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                    maxLength={4}
                    placeholder="KUL"
                    className="h-8 w-20 rounded-lg text-lg font-semibold tracking-wide"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField("fromCode")}
                    className="group flex items-center gap-1"
                  >
                    <span className="text-lg font-semibold tracking-wide">
                      {fromCode || <span className="text-muted-foreground">FROM</span>}
                    </span>
                    <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                  </button>
                )}

                <span className="text-muted-foreground">→</span>

                {editingField === "toCode" ? (
                  <Input
                    autoFocus
                    value={toCode}
                    onChange={(e) => setToCode(e.target.value.toUpperCase())}
                    onBlur={stopEdit}
                    onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                    maxLength={4}
                    placeholder="BKK"
                    className="h-8 w-20 rounded-lg text-lg font-semibold tracking-wide"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField("toCode")}
                    className="group flex items-center gap-1"
                  >
                    <span className="text-lg font-semibold tracking-wide">
                      {toCode || <span className="text-muted-foreground">TO</span>}
                    </span>
                    <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                  </button>
                )}
              </div>

              {/* City subtitle */}
              {subLabel && (
                <p className="mt-1 text-sm text-muted-foreground">{subLabel}</p>
              )}
            </div>

            {/* ── Timeline ── */}
            <div className="px-5 pb-6">
              <div className="relative pl-7">

                {/* Departure node */}
                <div className="relative">
                  <div className="absolute -left-7 top-1.5 flex h-4 w-4 items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Departure
                  </p>

                  <div className="mt-0.5">
                    <LocationAutocomplete
                      value={fromCity}
                      onChange={(v) => { setFromCity(v); setIsDirty(true) }}
                      placeholder="Departure city"
                      className="h-8 rounded-lg font-semibold"
                      nameOnly
                    />
                  </div>

                  <div className="mt-0.5">
                    {editingField === "departureTime" ? (
                      <Input
                        autoFocus
                        type="datetime-local"
                        value={departureTime}
                        min={tripStart ? `${tripStart}T00:00` : undefined}
                        max={tripEnd ? `${tripEnd}T23:59` : undefined}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        onBlur={stopEdit}
                        className="h-8 rounded-lg text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingField("departureTime")}
                        className="group flex items-center gap-1"
                      >
                        <span className="text-sm text-muted-foreground">
                          {departureTime ? fmtDateTime(departureTime) : "Set departure time"}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Duration line */}
                <div className="relative py-4">
                  <div className="absolute -left-[22px] inset-y-0 w-px border-l-2 border-dashed border-muted-foreground/20" />
                  {duration && (
                    <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
                      {duration}
                    </span>
                  )}
                </div>

                {/* Arrival node */}
                <div className="relative">
                  <div className="absolute -left-7 top-1.5 flex h-4 w-4 items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-primary/20" />
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Arrival
                  </p>

                  <div className="mt-0.5">
                    <LocationAutocomplete
                      value={toCity}
                      onChange={(v) => { setToCity(v); setIsDirty(true) }}
                      placeholder="Arrival city"
                      className="h-8 rounded-lg font-semibold"
                      nameOnly
                    />
                  </div>

                  <div className="mt-0.5">
                    {editingField === "arrivalTime" ? (
                      <Input
                        autoFocus
                        type="datetime-local"
                        value={arrivalTime}
                        min={departureTime || (tripStart ? `${tripStart}T00:00` : undefined)}
                        max={tripEnd ? `${tripEnd}T23:59` : undefined}
                        onChange={(e) => setArrivalTime(e.target.value)}
                        onBlur={stopEdit}
                        className="h-8 rounded-lg text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingField("arrivalTime")}
                        className="group flex items-center gap-1"
                      >
                        <span className="text-sm text-muted-foreground">
                          {arrivalTime ? fmtDateTime(arrivalTime) : "Set arrival time"}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 border-t border-dashed border-border" />

            {/* ── Cost + status ── */}
            <div className="grid grid-cols-2 gap-4 px-5 py-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Amount ({selectedCurrency})
                  </p>
                  <div className="flex overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => { setSelectedCurrency("THB"); setIsDirty(true) }}
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
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
                        "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                        selectedCurrency === "MYR"
                          ? "bg-[#6D8F87] text-white"
                          : "bg-card text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      MYR
                    </button>
                  </div>
                </div>
                {editingField === "amount" ? (
                  <Input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={stopEdit}
                    onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                    placeholder="0.00"
                    className="h-8 rounded-lg text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField("amount")}
                    className="group flex items-center gap-1 text-left"
                  >
                    <span className="font-semibold">
                      {amount ? (
                        `${selectedCurrency} ${amount}`
                      ) : (
                        <span className="font-normal text-muted-foreground text-sm">
                          Add amount
                        </span>
                      )}
                    </span>
                    <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                  </button>
                )}
                {amount && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedCurrency === "THB"
                      ? `≈ MYR ${(Number(amount) * 0.13).toFixed(2)}`
                      : `≈ THB ${(Number(amount) * 7.69).toFixed(0)}`}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) => { setPaymentStatus(v as Booking["payment_status"]); setIsDirty(true) }}
                >
                  <SelectTrigger className="h-8 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Cancel by ── */}
            <div className="px-5 pb-5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Cancel by (optional)
              </p>
              <Input
                type="date"
                value={cancellationDeadline}
                onChange={(e) => setCancellationDeadline(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* ── Confirmation # + Booking URL ── */}
            <div className="grid grid-cols-2 gap-4 px-5 pb-5">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Confirmation #
                </p>
                <Input
                  value={confirmationNumber}
                  onChange={(e) => setConfirmationNumber(e.target.value)}
                  placeholder="ABC123"
                  className="rounded-xl"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Booking URL
                </p>
                <Input
                  type="url"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* ── Notes ── */}
            <div className="px-5 pb-5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Notes (optional)
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                className="min-h-[80px] rounded-xl resize-none"
              />
            </div>

            {/* ── Attachments ── */}
            <div className="px-5 pb-5 space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Paperclip className="h-3 w-3" aria-hidden />
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

            {/* ── Add to itinerary (new only) ── */}
            {!booking && (
              <div className="px-5 pb-6">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#A9D6C5]/60 bg-[#A9D6C5]/10 px-4 py-3">
                  <Checkbox
                    id="transport-add-itinerary"
                    checked={addToItinerary}
                    onCheckedChange={(v) => setAddToItinerary(!!v)}
                    className="border-[#6D8F87] data-[state=checked]:bg-[#6D8F87] data-[state=checked]:border-[#6D8F87]"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Add to itinerary</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Create a matching activity on the itinerary board</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ── Sticky CTA ── */}
          <div className="shrink-0 border-t border-border bg-card p-4">
            <Button type="submit" className="w-full rounded-xl" disabled={saving || (!!booking && !isDirty)}>
              {saving ? (
                <><Spinner className="mr-2 size-4" /> Saving...</>
              ) : saveLabel === "saved" ? (
                "Saved ✓"
              ) : (
                "Save Transport"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
