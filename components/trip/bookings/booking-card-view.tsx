"use client"

import { useState } from "react"
import { Hotel, Bus, Plane, Utensils, Star, Package, Pencil, Trash2, Calendar, ExternalLink, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Booking } from "@/lib/types"

const TYPE_CONFIG = {
  accommodation: {
    label: "Accommodation",
    icon: Hotel,
    headerBg: "bg-[#8AD0C0]/25",
    iconColor: "text-[#27ba76]",
    border: "border-[#8AD0C0]/50",
  },
  transport: {
    label: "Transport",
    icon: Bus,
    headerBg: "bg-sky-50 dark:bg-sky-950/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-800",
  },
  dining: {
    label: "Dining",
    icon: Utensils,
    headerBg: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-500 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  activities: {
    label: "Activity",
    icon: Star,
    headerBg: "bg-[#B1DDC6]/30 dark:bg-[#27ba76]/10",
    iconColor: "text-[#27ba76]",
    border: "border-[#B1DDC6]/60",
  },
  other: {
    label: "Other",
    icon: Package,
    headerBg: "bg-secondary",
    iconColor: "text-muted-foreground",
    border: "border-border",
  },
}

function getBookingIcon(booking: Booking) {
  if (booking.type === "transport") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    return d.transport_type === "flight" ? Plane : Bus
  }
  return TYPE_CONFIG[booking.type]?.icon ?? Package
}

function getTypeLabel(booking: Booking) {
  if (booking.type === "transport") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    return d.transport_type === "flight" ? "Flight" : "Transport"
  }
  return TYPE_CONFIG[booking.type]?.label ?? "Other"
}

function formatDateDisplay(booking: Booking): string | null {
  if (booking.type === "dining") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    const dt = d.datetime as string | undefined
    if (!dt) return null
    return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }
  if (booking.type === "transport") {
    const d = (booking.details ?? {}) as Record<string, unknown>
    const dep = d.departure_time as string | undefined
    if (!dep) return null
    const [datePart, timePart] = dep.split("T")
    if (!datePart) return null
    const [y, m, day] = datePart.split("-").map(Number)
    const date = new Date(y, m - 1, day)
    const dateStr = date.toLocaleDateString(undefined, { dateStyle: "medium" })
    return timePart ? `${dateStr} · ${timePart.slice(0, 5)}` : dateStr
  }
  if (!booking.booking_date) return null
  const [y, m, d] = booking.booking_date.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const dateStr = date.toLocaleDateString(undefined, { dateStyle: "medium" })
  const time =
    booking.type === "accommodation" && booking.check_in_time
      ? ` · Check-in ${booking.check_in_time.slice(0, 5)}`
      : booking.type === "activities" && booking.departure_time
        ? ` · ${booking.departure_time.slice(0, 5)}`
        : ""
  return dateStr + time
}

function PaymentBadge({ status }: { status: Booking["payment_status"] }) {
  const styles =
    status === "paid" || status === "confirmed"
      ? "bg-[#27ba76]/15 text-[#27ba76] border border-[#27ba76]/30"
      : status === "partial"
        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
        : status === "cancelled"
          ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400"
          : "bg-secondary text-muted-foreground border border-transparent"
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", styles)}>
      {status}
    </span>
  )
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

function BookingCard({
  booking,
  onEdit,
  onDelete,
}: {
  booking: Booking
  onEdit: (b: Booking) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const config = TYPE_CONFIG[booking.type] ?? TYPE_CONFIG.other
  const Icon = getBookingIcon(booking)
  const typeLabel = getTypeLabel(booking)
  const dateDisplay = formatDateDisplay(booking)
  const d = (booking.details ?? {}) as Record<string, unknown>
  const notes = d.notes as string | undefined

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(booking.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        config.border,
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-2.5", config.headerBg)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.iconColor)} aria-hidden />
          <span className={cn("text-xs font-semibold", config.iconColor)}>{typeLabel}</span>
        </div>
        <PaymentBadge status={booking.payment_status} />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold leading-snug">{booking.title}</h3>
          {booking.confirmation_number && (
            <p className="mt-0.5 text-xs text-muted-foreground">#{booking.confirmation_number}</p>
          )}
        </div>

        {dateDisplay && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            <span>{dateDisplay}</span>
          </div>
        )}

        {booking.type === "accommodation" && booking.check_out_time && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <span>Check-out {booking.check_out_time.slice(0, 5)}</span>
          </div>
        )}

        {booking.type === "dining" && (d.party_size as number | undefined) != null && (
          <p className="text-xs text-muted-foreground">{d.party_size as number} guests</p>
        )}

        {booking.amount != null && (
          <p className="text-sm font-semibold text-foreground">
            {formatMoney(booking.amount, booking.currency ?? "USD")}
          </p>
        )}

        {notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{notes}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
        {booking.booking_url ? (
          <a
            href={booking.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#27ba76] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            View booking
          </a>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => onEdit(booking)}
            aria-label="Edit booking"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete booking"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BookingCardView({
  bookings,
  onEdit,
  onDelete,
}: {
  bookings: Booking[]
  onEdit: (booking: Booking) => void
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bookings.map((b) => (
        <BookingCard key={b.id} booking={b} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
