"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

// AUTH DISABLED FOR DEV: Sign out removed from menu (see components/dev-auto-signin-wrapper.tsx)
export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      const meta = data.user?.user_metadata as { full_name?: string } | undefined
      setName(meta?.full_name ?? data.user?.email?.split("@")[0] ?? null)
    })
  }, [])

  const initials = (name ?? email ?? "U").slice(0, 1).toUpperCase()

  return (
    <DropdownMenu>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">{initials}</AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium">{name ?? "Demo User"}</span>
          {email ? <span className="text-xs font-normal text-muted-foreground">{email}</span> : null}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
