"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Crown, LogOut, Mail, Trash2, UserPlus, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { removeCollaborator, leaveTrip } from "@/lib/supabase/trip-shares"
import { cancelInvitation } from "@/app/actions/cancel-invitation"
import { ShareTripDialog } from "./share-trip-dialog"
import { usePresence } from "@/hooks/use-presence"
import type { MemberWithProfile, TripInvitation } from "@/lib/types"

interface CollaboratorsSectionProps {
  tripId: string
  tripName: string
  currentUserId: string
  isOwner: boolean
  initialMembers: MemberWithProfile[]
  initialPendingInvitations: TripInvitation[]
}

export function CollaboratorsSection({
  tripId,
  tripName,
  currentUserId,
  isOwner,
  initialMembers,
  initialPendingInvitations,
}: CollaboratorsSectionProps) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [pendingInvitations, setPendingInvitations] = useState(initialPendingInvitations)
  const [shareOpen, setShareOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<MemberWithProfile | null>(null)
  const [pendingLeave, setPendingLeave] = useState(false)
  const { allOnlineUserIds } = usePresence(tripId)

  async function handleRemove(member: MemberWithProfile) {
    try {
      await removeCollaborator(tripId, member.user_id)
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
      toast.success("Collaborator removed")
      router.refresh()
    } catch {
      toast.error("Failed to remove collaborator")
    } finally {
      setPendingRemove(null)
    }
  }

  async function handleLeave() {
    try {
      await leaveTrip(tripId, currentUserId)
      toast.success("You left the trip")
      router.push("/trips")
    } catch {
      toast.error("Failed to leave trip")
    } finally {
      setPendingLeave(false)
    }
  }

  async function handleCancelInvitation(invitation: TripInvitation) {
    const result = await cancelInvitation(invitation.id, tripId)
    if (result.status === "success") {
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitation.id))
      toast.success("Invitation cancelled")
    } else {
      toast.error("Failed to cancel invitation")
    }
  }

  return (
    <>
      <Card className="rounded-2xl border-border lg:col-span-2">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-serif text-2xl">Travelers</h2>
            <p className="text-sm text-muted-foreground">Who&apos;s on this trip.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite
          </Button>
        </div>

        <ul className="divide-y divide-border">
          {/* Active members */}
          {members.map((m) => {
            const name = m.profile?.full_name ?? "Unnamed traveler"
            const isCurrentUser = m.user_id === currentUserId
            const isThisOwner = m.role === "owner"

            return (
              <li key={m.user_id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      {m.profile?.avatar_url ? (
                        <AvatarImage src={m.profile.avatar_url} alt={name} />
                      ) : null}
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {allOnlineUserIds.has(m.user_id) && (
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#A9D6C5] ring-2 ring-white dark:ring-card"
                        aria-label="Online"
                      />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {name}
                      {isCurrentUser && (
                        <span className="text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                      {isThisOwner && <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Owner" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.last_activity_at
                        ? `Active ${formatDistanceToNow(new Date(m.last_activity_at), { addSuffix: true })}`
                        : `Joined ${new Date(m.joined_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="rounded-full border-transparent bg-secondary capitalize text-primary"
                  >
                    {m.role}
                  </Badge>

                  {isOwner && !isCurrentUser && !isThisOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingRemove(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove {name}</span>
                    </Button>
                  )}

                  {!isOwner && isCurrentUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setPendingLeave(true)}
                    >
                      <LogOut className="mr-1.5 h-4 w-4" />
                      Leave
                    </Button>
                  )}
                </div>
              </li>
            )
          })}

          {/* Pending invitations */}
          {pendingInvitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-4 p-5 opacity-75">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    <Mail className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {inv.email}
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Pending
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Invited {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleCancelInvitation(inv)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancel invitation</span>
                </Button>
              )}
            </li>
          ))}

          {members.length === 0 && pendingInvitations.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">No members yet.</li>
          )}
        </ul>
      </Card>

      <ShareTripDialog
        tripId={tripId}
        tripName={tripName}
        isOwner={isOwner}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {/* Remove collaborator confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={() => setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove collaborator?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.profile?.full_name ?? "This person"} will lose access to the trip immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingRemove && handleRemove(pendingRemove)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave trip confirmation */}
      <AlertDialog open={pendingLeave} onOpenChange={setPendingLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave trip?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this trip. The owner can re-invite you later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLeave}
            >
              Leave trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
