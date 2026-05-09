import { createClient } from "./client"
import type { Notification } from "@/lib/types"

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function markRead(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
  if (error) throw error
}

export async function markAllRead(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false)
  if (error) throw error
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false)
  if (error) throw error
  return count ?? 0
}
