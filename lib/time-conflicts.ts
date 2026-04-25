import type { Activity } from "./types"

export function detectTimeConflicts(activities: Activity[]): Map<string, string[]> {
  const conflictMap = new Map<string, string[]>()

  const byDayAndBlock = new Map<string, Activity[]>()
  activities.forEach((a) => {
    if (!a.day_date || !a.time_block || a.is_wishlist) return
    const key = `${a.day_date}|${a.time_block}`
    if (!byDayAndBlock.has(key)) byDayAndBlock.set(key, [])
    byDayAndBlock.get(key)!.push(a)
  })

  byDayAndBlock.forEach((acts) => {
    if (acts.length <= 1) return
    acts.forEach((a) => {
      conflictMap.set(
        a.id,
        acts.filter((other) => other.id !== a.id).map((other) => other.id)
      )
    })
  })

  return conflictMap
}

export function hasTimeConflict(activityId: string, conflictMap: Map<string, string[]>): boolean {
  return (conflictMap.get(activityId)?.length ?? 0) > 0
}

export function getTimeConflictCount(activityId: string, conflictMap: Map<string, string[]>): number {
  return conflictMap.get(activityId)?.length ?? 0
}
