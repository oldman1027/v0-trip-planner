export type TimeBlock = "morning" | "afternoon" | "night"

export type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string
  end_date: string
  cover_image_url: string | null
  created_by: string
  created_at: string
}

export type TripMember = {
  trip_id: string
  user_id: string
  role: "owner" | "editor" | "viewer"
  joined_at: string
  profile?: Profile
}

export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

// Supabase returns embedded relations as arrays. Normalize to a single object.
export function normalizeMembers<
  T extends { profile: unknown } & Record<string, unknown>,
>(rows: T[] | null | undefined): Array<Omit<T, "profile"> & { profile: Profile | null }> {
  return (rows ?? []).map((row) => {
    const raw = (row as { profile: unknown }).profile
    const profile = Array.isArray(raw) ? ((raw[0] ?? null) as Profile | null) : ((raw ?? null) as Profile | null)
    return { ...(row as object), profile } as Omit<T, "profile"> & { profile: Profile | null }
  })
}

export type Activity = {
  id: string
  trip_id: string
  day_date: string
  time_block: TimeBlock
  position: number
  title: string
  location: string | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  cost_currency: string | null
  photo_url: string | null
  created_at: string
}

export type Booking = {
  id: string
  trip_id: string
  type: "hotel" | "flight" | "transport" | "other"
  title: string
  details: Record<string, unknown> | null
  amount: number | null
  currency: string | null
  payment_status: "pending" | "paid" | "partial"
  cancellation_deadline: string | null
  created_at: string
}
