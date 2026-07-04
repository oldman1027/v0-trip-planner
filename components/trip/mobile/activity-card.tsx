"use client"

import { useState } from "react"
import {
  ChevronDown, ChevronUp, MapPin, Clock, ExternalLink,
  Car, UtensilsCrossed, Building2, Star, Navigation,
  Copy, Check,
} from "lucide-react"
import type { Activity, Booking, MemberWithProfile } from "@/lib/types"

// ── helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const diff = toMinutes(end) - toMinutes(start)
  if (diff <= 0) return null
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// ── category icon + color ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  accommodation: "#6D8F87",
  transport:     "#D97706",
  dining:        "#E85D75",
  experiences:   "#7C3AED",
  other:         "#94A3B8",
}

const CATEGORY_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  transport:     "Transport",
  dining:        "Dining",
  experiences:   "Experiences",
  other:         "Other",
}

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
  const cls = `shrink-0`
  const props = { style: { color, width: size, height: size }, className: cls }
  switch (category) {
    case "transport":     return <Car {...props} />
    case "dining":        return <UtensilsCrossed {...props} />
    case "accommodation": return <Building2 {...props} />
    case "experiences":   return <Star {...props} />
    default:              return <Navigation {...props} />
  }
}

// ── thumbnail with fallback ──────────────────────────────────────────────────

function Thumbnail({ activity }: { activity: Activity }) {
  const color = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other
  const bg = color + "1A" // 10% opacity hex

  if (activity.photo_url) {
    return (
      <div className="relative h-12 w-12 shrink-0">
        <img
          src={activity.photo_url}
          alt=""
          className="h-12 w-12 rounded-xl object-cover"
          loading="lazy"
          onError={e => { e.currentTarget.style.display = "none" }}
        />
        {/* invisible fallback behind the img — shows if img hides itself */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ background: bg }}
          aria-hidden
        >
          <CategoryIcon category={activity.category} size={20} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      style={{ background: bg }}
    >
      <CategoryIcon category={activity.category} size={20} />
    </div>
  )
}

// ── copy button ──────────────────────────────────────────────────────────────

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-[12px]"
      style={{ color: "#6D8F87" }}
    >
      {copied
        ? <><Check className="h-3 w-3" /> Copied!</>
        : <><Copy className="h-3 w-3" /> {text}</>}
    </button>
  )
}

// ── expanded detail panel ────────────────────────────────────────────────────

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "#A9D6C5" }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function ExpandedDetail({
  activity,
  currency,
  linkedBooking,
  addedBy,
}: {
  activity: Activity
  currency: string
  linkedBooking: Booking | null
  addedBy: MemberWithProfile | null
}) {
  const mapsUrl = activity.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
    : null
  const dur = duration(activity.start_time, activity.end_time)
  const dot = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other

  return (
    <div
      className="flex flex-col gap-[10px] px-4 py-3"
      style={{ borderTop: "0.5px solid #D4C9BC", background: "#FDFAF6" }}
    >
      {/* Location */}
      {activity.location && (
        <Block label="Location">
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#6D8F87" }} />
            <span className="text-[13px] leading-snug" style={{ color: "#2C4A45" }}>
              {activity.location}
            </span>
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-[12px] font-medium"
              style={{ color: "#6D8F87", minHeight: 32 }}
            >
              <ExternalLink className="h-3 w-3" />
              Open in Maps
            </a>
          )}
        </Block>
      )}

      {/* Time */}
      {(activity.start_time || activity.end_time) && (
        <Block label="Time">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#6D8F87" }} />
            <span className="text-[13px]" style={{ color: "#2C4A45" }}>
              {activity.start_time?.slice(0, 5) ?? ""}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ""}
              {dur && (
                <span className="ml-1.5" style={{ color: "#9BA8A6" }}>
                  · {dur}
                </span>
              )}
            </span>
          </div>
        </Block>
      )}

      {/* Cost */}
      {activity.cost_amount && activity.cost_amount > 0 ? (
        <Block label="Cost">
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
            {fmt(activity.cost_amount, activity.cost_currency ?? currency)}
          </span>
        </Block>
      ) : null}

      {/* Category */}
      <Block label="Category">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
          <span className="text-[13px]" style={{ color: "#2C4A45" }}>
            {CATEGORY_LABELS[activity.category] ?? activity.category}
          </span>
        </div>
      </Block>

      {/* Notes */}
      {activity.notes && (
        <Block label="Notes">
          <div
            className="rounded-md px-2 py-2 text-[13px] leading-relaxed"
            style={{ background: "#F7F3EE", color: "#2C4A45", lineHeight: 1.6 }}
          >
            {activity.notes}
          </div>
        </Block>
      )}

      {/* Booking reference */}
      {linkedBooking?.confirmation_number && (
        <Block label="Booking reference">
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "#9BA8A6" }}>Confirmation:</span>
            <CopyText text={linkedBooking.confirmation_number} />
          </div>
        </Block>
      )}

      {/* Added by */}
      {addedBy?.profile?.full_name && (
        <Block label="Added by">
          <div className="flex items-center gap-2">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: "#6D8F87" }}
            >
              {addedBy.profile.full_name[0]?.toUpperCase()}
            </div>
            <span className="text-[13px]" style={{ color: "#2C4A45" }}>
              {addedBy.profile.full_name}
            </span>
          </div>
        </Block>
      )}
    </div>
  )
}

// ── main exported card ───────────────────────────────────────────────────────

export function ActivityCard({
  activity,
  seqNum,
  currency,
  bookings = [],
  members = [],
}: {
  activity: Activity
  seqNum: number
  currency: string
  bookings?: Booking[]
  members?: MemberWithProfile[]
}) {
  const [open, setOpen] = useState(false)
  const dot = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other

  const linkedBooking =
    bookings.find(b => b.id === (activity.linked_booking_id ?? activity.booking_id)) ?? null
  const addedBy =
    activity.created_by
      ? (members.find(m => m.user_id === activity.created_by) ?? null)
      : null

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "#E8E0D8", background: "#FFFBF4" }}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.03]"
        style={{ minHeight: 64 }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {/* Sequence badge */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: dot }}
        >
          {seqNum}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
            <p className="truncate text-sm font-semibold" style={{ color: "#2C4A45" }}>
              {activity.title}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "#9BA8A6" }}>
            {(activity.start_time || activity.end_time) && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {activity.start_time?.slice(0, 5) ?? ""}
                {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ""}
              </span>
            )}
            {activity.location && (
              <>
                <span>·</span>
                <span className="truncate">{activity.location.split(",")[0]}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {activity.cost_amount && activity.cost_amount > 0 ? (
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#2C4A45" }}>
              {fmt(activity.cost_amount, activity.cost_currency ?? currency)}
            </span>
          ) : null}
          <Thumbnail activity={activity} />
          {open
            ? <ChevronUp className="h-4 w-4" style={{ color: "#9BA8A6" }} />
            : <ChevronDown className="h-4 w-4" style={{ color: "#9BA8A6" }} />}
        </div>
      </button>

      {open && (
        <ExpandedDetail
          activity={activity}
          currency={currency}
          linkedBooking={linkedBooking}
          addedBy={addedBy}
        />
      )}
    </div>
  )
}

// ── compact variant for All Days tab ────────────────────────────────────────

export function ActivityCardCompact({
  activity,
  seqNum,
  currency,
  bookings = [],
  members = [],
}: {
  activity: Activity
  seqNum: number
  currency: string
  bookings?: Booking[]
  members?: MemberWithProfile[]
}) {
  const [open, setOpen] = useState(false)
  const dot = CATEGORY_COLORS[activity.category] ?? CATEGORY_COLORS.other

  const linkedBooking =
    bookings.find(b => b.id === (activity.linked_booking_id ?? activity.booking_id)) ?? null
  const addedBy =
    activity.created_by
      ? (members.find(m => m.user_id === activity.created_by) ?? null)
      : null

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03]"
        style={{ minHeight: 48 }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {/* Sequence badge (small) */}
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: dot }}
        >
          {seqNum}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "#2C4A45" }}>
            {activity.title}
          </p>
          {activity.start_time && (
            <p className="text-[11px]" style={{ color: "#9BA8A6" }}>
              <Clock className="mr-0.5 inline h-2.5 w-2.5" />
              {activity.start_time.slice(0, 5)}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ""}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activity.cost_amount && activity.cost_amount > 0 ? (
            <span className="text-xs tabular-nums" style={{ color: "#6D8F87" }}>
              {fmt(activity.cost_amount, activity.cost_currency ?? currency)}
            </span>
          ) : null}
          {open
            ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "#9BA8A6" }} />
            : <ChevronDown className="h-3.5 w-3.5 -rotate-90" style={{ color: "#9BA8A6" }} />}
        </div>
      </button>

      {open && (
        <ExpandedDetail
          activity={activity}
          currency={currency}
          linkedBooking={linkedBooking}
          addedBy={addedBy}
        />
      )}
    </div>
  )
}
