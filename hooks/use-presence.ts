"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface OnlineUser {
  userId: string
  name: string
  color: string
}

export function usePresence(tripId: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userId = user.id
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Someone"
      // Deterministic hue from userId so the same user always gets the same color
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
            await channel!.track({ userId, name, color })
          }
        })
    }

    init()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [tripId])

  return { onlineUsers }
}
