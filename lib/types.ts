export type TimeBlock = "morning" | "afternoon" | "night"

export type Trip = {
  id: string
  name: string
  destination: string | null
  start_date: string
  end_date: string
  cover_image_url: string | null
  default_currency: string
  created_by: string
  created_at: string
  is_sample?: boolean
  share_token: string | null
  share_token_expires_at: string | null
  is_public: boolean
}

export type TripMember = {
  trip_id: string
  user_id: string
  role: "owner" | "editor" | "viewer"
  joined_at: string
  last_activity_at?: string | null
  invited_by_user_id?: string | null
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
  day_date: string | null
  time_block: TimeBlock | null
  position: number
  title: string
  location: string | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_amount: number | null
  cost_currency: string | null
  photo_url: string | null
  category: "accommodation" | "transport" | "dining" | "experiences" | "other"
  booking_id: string | null
  linked_booking_id: string | null
  is_wishlist: boolean
  is_kiv: boolean
  created_at: string
  created_by?: string | null
}

export type KIVNote = {
  id: string
  trip_id: string
  content: string
  created_by: string | null
  created_at: string
}

export type BookingAttachment = {
  id: string
  booking_id: string
  trip_id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  public_url: string
  created_at: string
}

export type Booking = {
  id: string
  trip_id: string
  type: "accommodation" | "transport" | "dining" | "activities" | "other"
  title: string
  details: Record<string, unknown> | null
  amount: number | null
  currency: string | null
  payment_status: "pending" | "paid" | "partial" | "confirmed" | "tbc" | "cancelled"
  reservation_status: "confirmed" | "pending" | "tbc" | "cancelled" | null
  cancellation_deadline: string | null
  booking_date: string | null
  confirmation_number: string | null
  booking_url: string | null
  check_in_time: string | null
  check_out_time: string | null
  check_out_date: string | null
  departure_time: string | null
  arrival_time: string | null
  created_at: string
  booking_attachments?: BookingAttachment[]
}

export type ExpenseCategory = "accommodation" | "transport" | "food" | "activities" | "other"

export type ExpenseParticipant = {
  id: string
  trip_id: string
  name: string
  created_at: string
}

export type Expense = {
  id: string
  trip_id: string
  booking_id: string | null
  activity_id: string | null
  source_type: "manual" | "booking" | "activity"
  amount: number
  currency: string
  category: ExpenseCategory
  date: string
  description: string
  paid_by_user_id: string | null
  paid_by_participant_id: string | null
  created_at: string
  splits?: ExpenseSplit[]
}

export type ExpenseSplit = {
  id: string
  expense_id: string
  user_id: string | null
  participant_id: string | null
  amount: number
  paid: boolean
  settled: boolean
  created_at: string
}

export type TripBudget = {
  id: string
  trip_id: string
  category: ExpenseCategory
  budget_amount: number
  created_at: string
}

export type MemberWithProfile = Omit<TripMember, "profile"> & { profile: Profile | null }

export type TripInvitation = {
  id: string
  trip_id: string
  email: string
  invited_by_user_id: string | null
  status: "pending" | "accepted"
  created_at: string
}

export type TripShareLink = {
  id: string
  trip_id: string
  token: string
  created_by_user_id: string
  created_at: string
  last_used_at: string | null
  use_count: number
}

export type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
  metadata: Record<string, unknown> | null
}
