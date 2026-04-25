import { addDays, differenceInDays, format, parseISO } from "date-fns"

/** Parse a date-only string (YYYY-MM-DD) as a local date (no UTC drift). */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Format a Date to YYYY-MM-DD (local). */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function daysBetween(start: string, end: string): string[] {
  const s = parseDateOnly(start)
  const e = parseDateOnly(end)
  const diff = differenceInDays(e, s)
  const out: string[] = []
  for (let i = 0; i <= diff; i++) {
    out.push(formatDateOnly(addDays(s, i)))
  }
  return out
}

export function formatDayLabel(dateStr: string): string {
  return format(parseDateOnly(dateStr), "EEE, MMM d")
}

export function formatLongDate(dateStr: string): string {
  return format(parseDateOnly(dateStr), "MMM d, yyyy")
}

export function formatRange(start: string, end: string): string {
  const s = parseDateOnly(start)
  const e = parseDateOnly(end)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
}

export function tripDuration(start: string, end: string): number {
  return differenceInDays(parseDateOnly(end), parseDateOnly(start)) + 1
}

export { format, parseISO }
