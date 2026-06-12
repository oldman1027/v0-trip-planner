"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Activity, Booking, Trip } from "@/lib/types"

type KIVNote = { id: string; trip_id: string; content: string; created_at: string }

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: "0.5px solid #D4C9BC" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#F0EBE3] transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7C77]">
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-[#8B9894]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#8B9894]" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export function TripAssistantPanel({
  trip,
  activities,
  activityBookingMap,
  weather,
}: {
  trip: Trip
  selectedDay: string
  activities: Activity[]
  bookings: Booking[]
  activityBookingMap: Map<string, Booking>
  weather?: { icon: string; high: number; rainChance: number }
}) {
  const [notes, setNotes] = useState<KIVNote[]>([])
  const [noteInput, setNoteInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("kiv_notes")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setNotes(data as KIVNote[])
      })
  }, [trip.id])

  async function addNote() {
    const content = noteInput.trim()
    if (!content) return
    setNoteInput("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from("kiv_notes")
      .insert({ trip_id: trip.id, content, created_by: user?.id ?? null })
      .select()
      .single()
    if (error) { toast.error("Could not save note"); return }
    setNotes((prev) => [...prev, data as KIVNote])
  }

  async function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from("kiv_notes").delete().eq("id", id)
    if (error) toast.error("Could not delete note")
  }

  const dayActivities = activities.filter((a) => !a.is_wishlist && !a.is_kiv)
  const activityCount = dayActivities.length
  const daySpend = dayActivities.reduce((sum, a) => sum + (a.cost_amount ?? 0), 0)

  const pendingBookings = dayActivities.filter((a) => {
    if (!a.booking_id) return false
    const b = activityBookingMap.get(a.id)
    if (!b) return true
    const confirmed =
      b.confirmation_number ||
      b.reservation_status === "confirmed" ||
      (!b.reservation_status && b.payment_status === "confirmed")
    return !confirmed
  })

  const earlyStarts = dayActivities.filter(
    (a) => a.start_time && a.start_time < "08:00",
  )

  const attentionItems = [
    ...pendingBookings.map((a) => ({
      id: a.id,
      text: `${a.title} – booking pending`,
      type: "pending" as const,
    })),
    ...earlyStarts.map((a) => ({
      id: `early-${a.id}`,
      text: `Early start: ${a.title} at ${a.start_time?.slice(0, 5)}`,
      type: "early" as const,
    })),
  ]

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "0.5px solid #D4C9BC" }}
      >
        <p className="text-xs font-semibold text-[#2C4A45]">Trip Assistant</p>
      </div>

      {/* Today Snapshot */}
      <Section title="Today Snapshot">
        <div className="space-y-2.5">
          {weather ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7C77]">Weather</span>
              <span className="text-xs font-medium text-[#2C4A45]">
                {weather.icon} {weather.high}°C
                {weather.rainChance > 20 ? ` · ${weather.rainChance}% rain` : ""}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7C77]">Activities</span>
            <span className="text-xs font-medium text-[#2C4A45]">{activityCount}</span>
          </div>
          {daySpend > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7C77]">Est. spend</span>
              <span className="text-xs font-medium text-[#2C4A45]">
                {fmtCost(daySpend, trip.default_currency ?? "USD")}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Attention Needed */}
      <Section title="Attention Needed">
        {attentionItems.length === 0 ? (
          <p className="text-xs font-medium" style={{ color: "#6D8F87" }}>✓ All good</p>
        ) : (
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <div
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.type === "pending" ? "#F97316" : "#EF9F27" }}
                />
                <p className="text-xs text-[#2C4A45] leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="group flex items-start gap-2">
              <p className="flex-1 text-xs text-[#2C4A45] leading-relaxed">{note.content}</p>
              <button
                type="button"
                onClick={() => deleteNote(note.id)}
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-[#8B9894] hover:text-[#E68475]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={inputRef}
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void addNote() }
              }}
              placeholder="Add a note..."
              className="flex-1 rounded-lg border border-[#E9E1D7] bg-white px-2.5 py-1.5 text-xs placeholder:text-[#8B9894] outline-none focus:border-[#A9D6C5] transition-colors"
            />
            <button
              type="button"
              onClick={() => void addNote()}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6D8F87] text-white hover:bg-[#5A7870] transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}

function fmtCost(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
