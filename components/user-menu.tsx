"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog"

export function UserMenu() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { full_name?: string; avatar_url?: string } | undefined
      setEmail(data.user?.email ?? null)
      setName(meta?.full_name ?? data.user?.email?.split("@")[0] ?? null)
      setAvatarUrl(meta?.avatar_url ?? null)
      setUserId(data.user?.id ?? null)
    })
  }, [editOpen]) // re-fetch after dialog closes so avatar updates immediately

  const initials = (name ?? email ?? "U").slice(0, 1).toUpperCase()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? "User"} /> : null}
              <AvatarFallback className="bg-secondary text-secondary-foreground">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium">{name ?? "User"}</span>
            {email ? <span className="text-xs font-normal text-muted-foreground">{email}</span> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" aria-hidden />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {userId && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          currentName={name ?? ""}
          currentAvatarUrl={avatarUrl}
          userId={userId}
        />
      )}
    </>
  )
}
