"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { History, RotateCcw, X } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { recordHistory, type TripHistoryEntry } from "@/lib/trip-history"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function groupByDate(entries: TripHistoryEntry[]): [string, TripHistoryEntry[]][] {
  const map = new Map<string, TripHistoryEntry[]>()
  for (const e of entries) {
    const label = getDateLabel(e.created_at)
    const arr = map.get(label) ?? []
    arr.push(e)
    map.set(label, arr)
  }
  return [...map.entries()]
}

// ── Style maps ────────────────────────────────────────────────────────────────

const ACTION_ICON: Record<TripHistoryEntry["action"], string> = {
  added:   "✅",
  edited:  "✏️",
  deleted: "🗑️",
  moved:   "↕️",
}

const ACTION_COLOR: Record<TripHistoryEntry["action"], string> = {
  added:   "text-green-600 dark:text-green-400",
  edited:  "text-blue-600 dark:text-blue-400",
  deleted: "text-red-500",
  moved:   "text-amber-600 dark:text-amber-400",
}

// ── HistoryPanel ──────────────────────────────────────────────────────────────

export function HistoryPanel({
  tripId,
  open,
  onClose,
}: {
  tripId: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<TripHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    setLoading(true)
    supabase
      .from("trip_history")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries((data ?? []) as TripHistoryEntry[])
        setLoading(false)
      })
  }, [tripId, open])

  async function handleRestore(entry: TripHistoryEntry) {
    const confirmed = window.confirm(
      `Restore to this version from ${formatDateTime(entry.created_at)}?\n\nThis will replace all current activities and bookings with this snapshot.`,
    )
    if (!confirmed) return

    setRestoring(entry.id)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { activities, bookings } = entry.snapshot

      // Delete activities first (they reference bookings), then bookings
      await supabase.from("activities").delete().eq("trip_id", tripId)
      await supabase.from("bookings").delete().eq("trip_id", tripId)

      // Re-insert with original IDs (preserves booking_id references)
      if (bookings?.length) {
        const { error } = await supabase.from("bookings").insert(bookings)
        if (error) throw error
      }
      if (activities?.length) {
        const VALID_CATEGORIES = ['accommodation','transport','dining','experiences','other']
        const sanitized = activities.map((a: Record<string, unknown>) => ({
          ...a,
          category: VALID_CATEGORIES.includes(a.category as string) ? a.category : 'other',
        }))
        const { error } = await supabase.from("activities").insert(sanitized)
        if (error) throw error
      }

      // Fetch profile for display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
      const userName = profile?.full_name ?? user.email?.split("@")[0] ?? "Someone"

      // Record the restore action itself
      void recordHistory({
        supabase,
        tripId,
        userId: user.id,
        userName,
        action: "edited",
        entityType: "trip",
        entityName: `Restored to ${formatDateTime(entry.created_at)}`,
      }).catch(() => null)

      toast.success("Trip restored successfully")
      onClose()
      router.refresh()
    } catch (err) {
      toast.error("Restore failed — please try again", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRestoring(null)
    }
  }

  const grouped = groupByDate(entries)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-80 flex-col p-0 gap-0">
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3 space-y-0">
          <div>
            <SheetTitle className="text-sm font-semibold">Version History</SheetTitle>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading…
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <History className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No history yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                Changes will appear here as you edit the trip.
              </p>
            </div>
          )}

          {!loading &&
            grouped.map(([date, dateEntries]) => (
              <div key={date}>
                {/* Date header */}
                <div className="sticky top-0 border-b border-border bg-muted/40 px-4 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {date}
                  </span>
                </div>

                {dateEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span aria-hidden className="text-sm leading-none">
                            {ACTION_ICON[entry.action]}
                          </span>
                          <span className={cn("text-xs font-medium", ACTION_COLOR[entry.action])}>
                            {entry.action}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(entry.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium leading-snug">
                          {entry.entity_name}
                        </p>
                        <p className="text-xs text-muted-foreground">by {entry.changed_by_name}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestore(entry)}
                        disabled={restoring !== null}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-opacity",
                          "opacity-0 group-hover:opacity-100",
                          restoring === entry.id && "opacity-100 cursor-wait",
                          restoring !== null && restoring !== entry.id && "pointer-events-none",
                        )}
                        title="Restore to this version"
                      >
                        {restoring === entry.id ? (
                          "…"
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3" aria-hidden />
                            Restore
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>

        {/* Footer warning */}
        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            ⚠️ Restoring replaces all current activities and bookings with the selected version.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
