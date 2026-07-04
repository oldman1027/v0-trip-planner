export const C = {
  teal:       "#6D8F87",
  tealDark:   "#2C4A45",
  tealLight:  "#EDF5F2",
  tealMuted:  "#A9D6C5",
  sand:       "#FFFBF4",
  sandMid:    "#FDFAF6",
  sandBorder: "#D4C9BC",
  sandDark:   "#F7F3EE",
  body:       "#2C4A45",
  muted:      "#6D8F87",
  faint:      "#9BA8A6",
  white:      "#FFFFFF",
  orange:     "#D97706",
  red:        "#E85D75",
  purple:     "#7C3AED",
  blue:       "#3B82F6",
  slate:      "#94A3B8",
}

export const CATEGORY_COLORS: Record<string, string> = {
  accommodation: "#7C3AED",
  transport:     "#94A3B8",
  dining:        "#D97706",
  food:          "#D97706",
  experiences:   "#3B82F6",
  activities:    "#3B82F6",
  other:         "#9BA8A6",
}

export function fmtCurrency(amount: number | null, currency: string | null): string {
  if (amount == null) return "—"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency ?? ""} ${Math.round(amount)}`
  }
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    weekday: "long",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
  })
}

export function fmtDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
  })
}

export function fmtTime(t: string | null): string {
  if (!t) return "—"
  return t.slice(0, 5)
}

export function tripDays(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start + "T00:00:00")
  const last = new Date(end + "T00:00:00")
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
