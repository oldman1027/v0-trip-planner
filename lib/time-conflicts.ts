import type { Activity } from "./types"

export type ConflictInfo = {
  kind: "overlap"
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
  return a.end_time ? toMins(a.end_time) : startMins + 60
}

function add(map: ConflictMap, id: string, info: ConflictInfo) {
  const list = map.get(id) ?? []
  if (!list.some((c) => c.withId === info.withId)) {
    list.push(info)
    map.set(id, list)
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Flags activities whose time windows actually overlap on the same day.
 * A conflicts with B iff A.start < B.end AND A.end > B.start.
 * Activities without a start_time are ignored.
 */
export function detectConflicts(activities: Activity[]): ConflictMap {
  const map: ConflictMap = new Map()

  const timed = activities.filter((a) => !a.is_wishlist && a.day_date && a.start_time)

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

    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]
      const aStart = toMins(a.start_time!)
      const aEnd = endOf(a, aStart)

      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        const bStart = toMins(b.start_time!)

        // Sorted by start — if b starts at or after a ends, no overlap possible
        if (bStart >= aEnd) break

        const bEnd = endOf(b, bStart)

        // True overlap: aStart < bEnd AND aEnd > bStart
        if (aStart < bEnd && aEnd > bStart) {
          const aRange = `${fmt(a.start_time!)}–${a.end_time ? fmt(a.end_time) : "?"}`
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
    }
  }

  return map
}
