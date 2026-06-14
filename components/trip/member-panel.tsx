"use client"

import { format } from "date-fns"
import { X, MoreHorizontal, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useMemberFilter } from "./member-filter-context"

export type MemberEntry = {
  userId: string
  name: string
  avatarUrl: string | null
  role: "owner" | "editor" | "viewer"
  joinedAt: string
}

const ROLE_STYLE: Record<MemberEntry["role"], { label: string; cls: string }> = {
  owner:  { label: "Owner",  cls: "bg-[#E6F4F2] text-[#157F7A] border-[#B7E2DE]" },
  editor: { label: "Editor", cls: "bg-[#E8F6EE] text-[#2E6B59] border-[#9ED6BE]" },
  viewer: { label: "Viewer", cls: "bg-[#F5F0E8] text-[#6B7C77] border-[#D4C9BC]" },
}

export function MemberPanel({
  isOpen,
  onClose,
  members,
  onlineUserIds,
  isOwner,
  currentUserId,
  tripId,
  onRefresh,
  onInvite,
}: {
  isOpen: boolean
  onClose: () => void
  members: MemberEntry[]
  onlineUserIds: Set<string>
  isOwner: boolean
  currentUserId: string | null
  tripId: string
  onRefresh: () => void
  onInvite: () => void
}) {
  const { filterCreatorId, setFilterCreatorId } = useMemberFilter()

  async function handleChangeRole(userId: string, newRole: "editor" | "viewer") {
    const supabase = createClient()
    const { error } = await supabase
      .from("trip_members")
      .update({ role: newRole })
      .eq("trip_id", tripId)
      .eq("user_id", userId)
    if (error) { toast.error("Could not change role"); return }
    toast.success("Role updated")
    onRefresh()
  }

  async function handleRemove(userId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from("trip_members")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId)
    if (error) { toast.error("Could not remove member"); return }
    toast.success("Member removed")
    onRefresh()
  }

  function toggleFilter(userId: string) {
    setFilterCreatorId(filterCreatorId === userId ? null : userId)
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "w-[280px] max-[767px]:w-full",
          "transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          background: "#FDFAF6",
          borderRight: "0.5px solid #D4C9BC",
          boxShadow: "4px 0 20px rgba(44,74,69,0.10)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "0.5px solid #D4C9BC" }}
        >
          <h2 className="font-serif text-base text-[#2C4A45]">Trip Members</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6B7C77] transition-colors hover:bg-[#E8DDD0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter hint */}
        {filterCreatorId && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#F3ECFF] text-[11px] text-[#6A55A3]" style={{ borderBottom: "0.5px solid #D6C6F7" }}>
            <span>Filtering by member</span>
            <button
              type="button"
              onClick={() => setFilterCreatorId(null)}
              className="ml-auto flex items-center gap-1 underline underline-offset-2 hover:no-underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto py-2">
          {members.map((m) => {
            const isOnline = onlineUserIds.has(m.userId)
            const isFiltered = filterCreatorId === m.userId
            const rs = ROLE_STYLE[m.role]
            const initial = m.name[0]?.toUpperCase() ?? "?"
            return (
              <div
                key={m.userId}
                className={cn(
                  "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F5EFE8]/60",
                  isFiltered && "bg-[#F3ECFF]/40",
                )}
              >
                <button
                  type="button"
                  title={isFiltered ? "Clear filter" : `Show ${m.name}'s activities`}
                  onClick={() => toggleFilter(m.userId)}
                  className="relative shrink-0 focus:outline-none"
                >
                  <Avatar className={cn("h-9 w-9 transition-all", isFiltered && "ring-2 ring-[#6D8F87] ring-offset-1")}>
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{ background: "#A9D6C5", color: "#2C4A45" }}
                    >
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#22C55E] ring-[1.5px] ring-[#FDFAF6]" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[#2C4A45]">
                      {m.name}{m.userId === currentUserId ? " (you)" : ""}
                    </span>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", rs.cls)}>
                      {rs.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px]">
                    {isOnline ? (
                      <span className="font-medium text-[#22C55E]">Online now</span>
                    ) : (
                      <span className="text-[#6B7C77]">Joined {format(new Date(m.joinedAt), "MMM d")}</span>
                    )}
                  </div>
                </div>

                {isOwner && m.userId !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8B9894] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#E8DDD0]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-44">
                      {m.role !== "editor" && (
                        <DropdownMenuItem onClick={() => handleChangeRole(m.userId, "editor")}>
                          Change to Editor
                        </DropdownMenuItem>
                      )}
                      {m.role !== "viewer" && (
                        <DropdownMenuItem onClick={() => handleChangeRole(m.userId, "viewer")}>
                          Change to Viewer
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleRemove(m.userId)}
                      >
                        Remove from trip
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>

        {/* Invite button */}
        <div className="p-4" style={{ borderTop: "0.5px solid #D4C9BC" }}>
          <button
            type="button"
            onClick={onInvite}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#6D8F87] px-4 py-2.5 text-sm font-medium text-[#6D8F87] transition-colors hover:bg-[#6D8F87] hover:text-white"
          >
            <UserPlus className="h-4 w-4" />
            Invite member
          </button>
        </div>
      </div>
    </>
  )
}
