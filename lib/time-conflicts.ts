import type { Activity } from "./types"

// Assumed minimum gap (minutes) needed to travel between two distinct locations.
const TRAVEL_BUFFER_MINS = 20
// Assumed duration when an activity has no end_time.
const DEFAULT_DURATION_MINS = 60

export type ConflictKind = "overlap" | "travel"

export type ConflictInfo = {
  kind: ConflictKind
  withId: string
  withTitle: string
  message: string
}

export type ConflictMap = Map<string, ConflictInfo[]>

// ── Helpers ────────────────────────────────────────────────────────────────

function toMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

function fmt(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

function endOf(a: Activity, startMins: number): number {
  return a.end_time ? toMins(a.end_time) : startMins + DEFAULT_DURATION_MINS
}

function add(map: ConflictMap, id: string, info: ConflictInfo) {
  const list = map.get(id) ?? []
  // Deduplicate: same kind + same partner
  if (!list.some((c) => c.kind === info.kind && c.withId === info.withId)) {
    list.push(info)
    map.set(id, list)
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Detects two kinds of scheduling problem:
 *
 * "overlap"  — two activities' time windows intersect on the same day.
 * "travel"   — the gap between consecutive activities at different locations
 *              is shorter than TRAVEL_BUFFER_MINS.
 *
 * Only activities with a start_time participate; untimed activities are
 * ignored because their precise window is unknown.
 */
export function detectConflicts(activities: Activity[]): ConflictMap {
  const map: ConflictMap = new Map()

  const timed = activities.filter((a) => !a.is_wishlist && a.day_date && a.start_time)

  // Group by day
  const byDay = new Map<string, Activity[]>()
  for (const a of timed) {
    const bucket = byDay.get(a.day_date!) ?? []
    bucket.push(a)
    byDay.set(a.day_date!, bucket)
  }

  for (const dayActs of byDay.values()) {
    const sorted = [...dayActs].sort(
      (a, b) => toMins(a.start_time!) - toMins(b.start_time!),
    )

    // ── Overlap ────────────────────────────────────────────────────────────
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      const aStart = toMins(a.start_time!)
      const aEnd = endOf(a, aStart)
      const aRange = `${fmt(a.start_time!)}–${a.end_time ? fmt(a.end_time) : "?"}`

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        const bStart = toMins(b.start_time!)
        if (bStart >= aEnd) break // sorted — nothing further overlaps with a

        const bRange = `${fmt(b.start_time!)}–${b.end_time ? fmt(b.end_time) : "?"}`
        const range = `${aRange} vs ${bRange}`

        add(map, a.id, {
          kind: "overlap", withId: b.id, withTitle: b.title,
          message: `Overlaps with "${b.title}" (${range})`,
        })
        add(map, b.id, {
          kind: "overlap", withId: a.id, withTitle: a.title,
          message: `Overlaps with "${a.title}" (${range})`,
        })
      }
    }

    // ── Travel time ────────────────────────────────────────────────────────
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]

      // Need distinct, non-empty locations to estimate travel
      if (!a.location || !b.location) continue
      if (a.location.trim().toLowerCase() === b.location.trim().toLowerCase()) continue

      const aStart = toMins(a.start_time!)
      const aEnd = endOf(a, aStart)
      const bStart = toMins(b.start_time!)
      const gap = bStart - aEnd

      if (gap < 0) continue // already flagged as overlap
      if (gap >= TRAVEL_BUFFER_MINS) continue

      add(map, a.id, {
        kind: "travel", withId: b.id, withTitle: b.title,
        message: `Only ${gap}m gap before "${b.title}" — allow ~${TRAVEL_BUFFER_MINS}m to travel`,
      })
      add(map, b.id, {
        kind: "travel", withId: a.id, withTitle: a.title,
        message: `Only ${gap}m gap after "${a.title}" — allow ~${TRAVEL_BUFFER_MINS}m to travel`,
      })
    }
  }

  return map
}
