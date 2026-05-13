"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { inviteToTrip } from "@/app/actions/invite-to-trip"
import { sendNewUserInvitation } from "@/app/actions/send-new-user-invitation"

export function InviteMemberForm({ tripId }: { tripId: string }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return
    setLoading(true)

    try {
      const result = await inviteToTrip(tripId, trimmedEmail)
      if (result.status === "success") {
        toast.success(`Invited ${result.memberName}`)
        setEmail("")
      } else if (result.status === "not_found") {
        const emailResult = await sendNewUserInvitation(tripId, trimmedEmail)
        if (emailResult.status === "success") {
          toast.success(`Invitation sent to ${trimmedEmail}`)
          setEmail("")
        } else {
          toast.error("No Tripletto account found and email could not be sent")
        }
      } else if (result.status === "already_member") {
        toast.info("That person is already a collaborator")
      } else if (result.status === "unauthorized") {
        toast.error("Only the trip owner can invite collaborators")
      } else {
        toast.error("Something went wrong — please try again")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border p-5">
      <h3 className="font-serif text-xl">Invite by email</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add travelers who can view and edit this trip.
      </p>
      <form onSubmit={onSubmit} className="mt-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invite">Email address</FieldLabel>
            <Input
              id="invite"
              type="email"
              required
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </Field>
          <Button type="submit" className="w-full rounded-xl" disabled={loading || !email.trim()}>
            {loading ? (
              <>
                <Spinner className="mr-2 size-4" /> Sending...
              </>
            ) : (
              "Send invite"
            )}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  )
}
