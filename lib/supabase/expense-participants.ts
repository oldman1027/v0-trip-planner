import { createClient } from "./client"
import type { ExpenseParticipant } from "@/lib/types"

export async function getExpenseParticipants(tripId: string): Promise<ExpenseParticipant[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("expense_participants")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createExpenseParticipant(
  tripId: string,
  name: string,
): Promise<ExpenseParticipant> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("expense_participants")
    .insert({ trip_id: tripId, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExpenseParticipant(
  id: string,
  name: string,
): Promise<ExpenseParticipant> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("expense_participants")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpenseParticipant(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("expense_participants")
    .delete()
    .eq("id", id)
  if (error) throw error
}

export async function participantHasSplits(participantId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("expense_splits")
    .select("id")
    .eq("participant_id", participantId)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
