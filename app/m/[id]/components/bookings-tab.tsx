"use client"

import { useState } from "react"
import { Plane, Building2, Package, MapPin, ExternalLink, Copy, Check, FileText, Download } from "lucide-react"
import type { Booking, BookingAttachment } from "@/lib/types"

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium active:bg-black/[0.05]"
      style={{ color: "#6D8F87", background: "#EDF5F2", minHeight: 36 }}
      aria-label="Copy confirmation number"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  const mapsUrl = (booking.details as Record<string, unknown> | null)?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String((booking.details as Record<string, unknown>).address))}`
    : null

  const isTransport = booking.type === "transport"
  const isAccommodation = booking.type === "accommodation"
  const details = (booking.details ?? {}) as Record<string, unknown>

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "#EDF5F2" }}
        >
          {isTransport ? (
            <Plane className="h-5 w-5" style={{ color: "#6D8F87" }} />
          ) : isAccommodation ? (
            <Building2 className="h-5 w-5" style={{ color: "#6D8F87" }} />
          ) : (
            <Package className="h-5 w-5" style={{ color: "#6D8F87" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight" style={{ color: "#2C4A45" }}>
            {booking.title}
          </p>
          {booking.booking_date && (
            <p className="mt-0.5 text-xs" style={{ color: "#9BA8A6" }}>
              {new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
          {booking.amount && booking.currency && (
            <p className="mt-0.5 text-xs font-medium tabular-nums" style={{ color: "#6D8F87" }}>
              {fmt(booking.amount, booking.currency)}
            </p>
          )}
        </div>
      </div>

      {/* Flight-specific info */}
      {isTransport && (booking.departure_time || booking.arrival_time) && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "#EDF5F2" }}>
          {typeof details.flight_number === "string" && (
            <p className="text-xs font-semibold" style={{ color: "#2C4A45" }}>
              {details.flight_number}
              {typeof details.route === "string" ? ` · ${details.route}` : ""}
            </p>
          )}
          {booking.departure_time && (
            <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
              {booking.departure_time.slice(0, 5)}
            </p>
          )}
          {typeof details.terminal === "string" && (
            <p className="text-xs" style={{ color: "#9BA8A6" }}>
              Terminal {details.terminal}
            </p>
          )}
        </div>
      )}

      {/* Hotel-specific info */}
      {isAccommodation && (booking.check_in_time || booking.check_out_date) && (
        <div className="mt-3 flex gap-4 rounded-xl p-3" style={{ background: "#EDF5F2" }}>
          {booking.check_in_time && (
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "#9BA8A6" }}>Check-in</p>
              <p className="text-sm font-semibold" style={{ color: "#2C4A45" }}>
                {booking.check_in_time.slice(0, 5)}
              </p>
            </div>
          )}
          {booking.check_out_date && (
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "#9BA8A6" }}>Check-out</p>
              <p className="text-sm font-semibold" style={{ color: "#2C4A45" }}>
                {new Date(booking.check_out_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {booking.check_out_time ? ` · ${booking.check_out_time.slice(0, 5)}` : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation number */}
      {booking.confirmation_number && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: "#9BA8A6" }}>
              Confirmation
            </p>
            <p
              className="mt-0.5 truncate font-mono text-base font-semibold tracking-wide"
              style={{ color: "#2C4A45" }}
            >
              {booking.confirmation_number}
            </p>
          </div>
          <CopyButton text={booking.confirmation_number} />
        </div>
      )}

      {/* Open in Maps */}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 text-xs font-medium"
          style={{ color: "#6D8F87" }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Open in Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Attachments */}
      {booking.booking_attachments && booking.booking_attachments.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "#E8E0D8" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "#9BA8A6" }}>
            Attachments
          </p>
          {booking.booking_attachments.map((att: BookingAttachment) => {
            const isPdf = att.file_type === "application/pdf" || att.file_name.toLowerCase().endsWith(".pdf")
            return (
              <a
                key={att.id}
                href={att.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl p-3 active:bg-black/[0.04]"
                style={{ background: "#EDF5F2", minHeight: 44 }}
              >
                <span style={{ color: "#6D8F87", display: "flex", flexShrink: 0 }}>
                  {isPdf ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: "#2C4A45" }}>
                  {att.file_name}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: "#9BA8A6" }} />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

const TYPE_LABELS: Record<string, string> = {
  transport:     "Flights & Transport",
  accommodation: "Accommodation",
  dining:        "Dining",
  activities:    "Experiences",
  other:         "Other",
}
const TYPE_ORDER = ["transport", "accommodation", "dining", "activities", "other"]

export function BookingsTab({ bookings, tripId }: { bookings: Booking[]; tripId: string }) {
  const grouped = TYPE_ORDER.map(type => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    items: bookings.filter(b => b.type === type),
  })).filter(g => g.items.length > 0)

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <Building2 className="h-10 w-10" style={{ color: "#D4C9BC" }} />
        <p className="text-sm" style={{ color: "#9BA8A6" }}>No bookings yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-4 pt-4">
      {/* Export PDF button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => window.open(`/trips/${tripId}/briefing`, "_blank", "noopener")}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
          style={{ color: "#6D8F87", borderColor: "#A9D6C5", background: "white", minHeight: 36 }}
        >
          📄 Export PDF
        </button>
      </div>

      {grouped.map(g => (
        <div key={g.type} className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#9BA8A6" }}>
            {g.label}
          </p>
          {g.items.map(b => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      ))}
    </div>
  )
}
