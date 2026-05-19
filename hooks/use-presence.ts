"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface OnlineUser {
  userId: string
  name: string
  avatarUrl: string | null
  color: string
  online_at: string
}

export function usePresence(tripId: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const userId = user.id
      setCurrentUserId(userId)

      // Fetch profile for accurate name + avatar (authoritative source)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle()

      const name =
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Someone"
      const avatarUrl = profile?.avatar_url ?? null
      // Deterministic hue so same user always gets same color (used as fallback bg)
      const hue = parseInt(userId.replace(/-/g, "").slice(0, 8), 16) % 360
      const color = `hsl(${hue}, 65%, 50%)`

      channel = supabase.channel(`presence:trip:${tripId}`, {
        config: { presence: { key: userId } },
      })

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<OnlineUser>()
          const others = Object.values(state)
            .flat()
            .filter((u) => u.userId !== userId)
          setOnlineUsers(others)
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({
              userId,
              name,
              avatarUrl,
              color,
              online_at: new Date().toISOString(),
            })
            // Stamp last_activity_at so the collaborators list shows accurate activity
            await supabase
              .from("trip_members")
              .update({ last_activity_at: new Date().toISOString() })
              .eq("trip_id", tripId)
              .eq("user_id", userId)
          }
        })
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [tripId])

  // Includes self — current user is always online by definition of viewing the page
  const allOnlineUserIds = new Set<string>(
    [currentUserId, ...onlineUsers.map((u) => u.userId)].filter(Boolean) as string[],
  )

  return { onlineUsers, allOnlineUserIds }
}
