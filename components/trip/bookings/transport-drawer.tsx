"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Trash2, Pencil, Plane, Bus } from "lucide-react"
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
}

type EditingField =
  | "flightNumber"
  | "fromCode"
  | "toCode"
  | "fromCity"
  | "toCity"
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
  currency: string
  tripStart: string
  tripEnd: string
  onClose: () => void
  onSave: (input: BookingSaveInput) => Promise<void>
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
  const [paymentStatus, setPaymentStatus] = useState<Booking["payment_status"]>("pending")
  const [cancellationDeadline, setCancellationDeadline] = useState("")
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) {
      setEditingField(null)
      return
    }
    if (booking) {
      const d = (booking.details ?? {}) as TransportDetails & { transport_type?: string }
      setType(d.transport_type === "flight" ? "flight" : "transport")
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
    } else {
      setType(defaultType)
      setFlightNumber("")
      setFromCode("")
      setFromCity("")
      setToCode("")
      setToCity("")
      setDepartureTime("")
      setArrivalTime("")
      setAmount("")
      setPaymentStatus("pending")
      setCancellationDeadline("")
    }
    setEditingField(null)
  }, [booking, open, defaultType])

  const duration = calcDuration(departureTime, arrivalTime)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        id: booking?.id,
        type: "transport",
        title: flightNumber.trim() || (type === "flight" ? "Flight" : "Transport"),
        details: {
          transport_type: type,
          from_code: fromCode.trim().toUpperCase() || null,
          from_city: fromCity.trim() || null,
          to_code: toCode.trim().toUpperCase() || null,
          to_city: toCity.trim() || null,
          departure_time: departureTime || null,
          arrival_time: arrivalTime || null,
        },
        confirmation_number: null,
        booking_url: null,
        check_in_time: null,
        check_out_time: null,
        departure_time: null,
        arrival_time: null,
        amount: amount ? Number(amount) : null,
        currency: booking?.currency ?? currency,
        payment_status: paymentStatus,
        cancellation_deadline: cancellationDeadline
          ? new Date(cancellationDeadline + "T23:59:00").toISOString()
          : null,
        booking_date: departureTime ? departureTime.slice(0, 10) : null,
      })
      onClose()
    } catch (err) {
      toast.error("Could not save transport", {
        description: err instanceof Error ? err.message : "Unknown",
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
  }

  const fromDisplay = fromCity || fromCode || null
  const toDisplay = toCity || toCode || null
  const routeLabel =
    fromCode && toCode ? `${fromCode.toUpperCase()} → ${toCode.toUpperCase()}` : null
  const subLabel =
    fromCity && toCity ? `${fromCity} → ${toCity}` : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md overflow-hidden">
        <form onSubmit={handleSave} className="flex h-full flex-col">
          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Type toggle + delete */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setType("transport")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    type === "transport"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Bus className="h-3.5 w-3.5" />
                  Transport
                </button>
                <button
                  type="button"
                  onClick={() => setType("flight")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    type === "flight"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Plane className="h-3.5 w-3.5" />
                  Flight
                </button>
              </div>

              {booking && (
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
              )}
            </div>

            {/* ── Flight card ── */}
            <div className="mx-5 mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
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
                    {editingField === "fromCity" ? (
                      <Input
                        autoFocus
                        value={fromCity}
                        onChange={(e) => setFromCity(e.target.value)}
                        onBlur={stopEdit}
                        onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                        placeholder="Kuala Lumpur Intl"
                        className="h-8 rounded-lg font-semibold"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingField("fromCity")}
                        className="group flex items-center gap-1 text-left"
                      >
                        <span className="font-semibold">
                          {fromDisplay || (
                            <span className="font-normal text-muted-foreground">
                              Departure city
                            </span>
                          )}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                      </button>
                    )}
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
                    {editingField === "toCity" ? (
                      <Input
                        autoFocus
                        value={toCity}
                        onChange={(e) => setToCity(e.target.value)}
                        onBlur={stopEdit}
                        onKeyDown={(e) => e.key === "Enter" && stopEdit()}
                        placeholder="Bangkok Suvarnabhumi"
                        className="h-8 rounded-lg font-semibold"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingField("toCity")}
                        className="group flex items-center gap-1 text-left"
                      >
                        <span className="font-semibold">
                          {toDisplay || (
                            <span className="font-normal text-muted-foreground">
                              Arrival city
                            </span>
                          )}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                      </button>
                    )}
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
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount ({currency})
                </p>
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
                        `${currency} ${amount}`
                      ) : (
                        <span className="font-normal text-muted-foreground text-sm">
                          Add amount
                        </span>
                      )}
                    </span>
                    <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
                  </button>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) => setPaymentStatus(v as Booking["payment_status"])}
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
            <div className="px-5 pb-8">
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
          </div>

          {/* ── Sticky CTA ── */}
          <div className="shrink-0 border-t border-border bg-card p-4">
            <Button type="submit" className="w-full rounded-xl" disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Saving...
                </>
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
