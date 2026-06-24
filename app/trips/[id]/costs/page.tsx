import { createClient } from "@/lib/supabase/server"
import { CostsClient } from "@/components/trip/costs/costs-client"
import { normalizeMembers } from "@/lib/types"
import type { Trip, Booking, Expense, TripBudget, ExpenseParticipant, Activity } from "@/lib/types"

export default async function CostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: trip },
    { data: expensesRaw },
    { data: budgetsRaw },
    { data: membersRaw },
    { data: bookings },
    { data: participantsRaw },
    { data: activitiesRaw },
  ] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    supabase
      .from("expenses")
      .select("*, splits:expense_splits(*)")
      .eq("trip_id", id)
      .order("date", { ascending: false }),
    supabase.from("trip_budgets").select("*").eq("trip_id", id),
    supabase
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id),
    supabase.from("bookings").select("*").eq("trip_id", id),
    supabase
      .from("expense_participants")
      .select("*")
      .eq("trip_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("activities").select("*").eq("trip_id", id),
  ])

  if (!trip) return null

  return (
    <CostsClient
      trip={trip}
      initialExpenses={(expensesRaw ?? []) as Expense[]}
      initialBudgets={(budgetsRaw ?? []) as TripBudget[]}
      members={normalizeMembers(membersRaw)}
      initialBookings={(bookings ?? []) as Booking[]}
      currentUserId={user?.id ?? ""}
      initialParticipants={(participantsRaw ?? []) as ExpenseParticipant[]}
      activities={(activitiesRaw ?? []) as Activity[]}
    />
  )
}
