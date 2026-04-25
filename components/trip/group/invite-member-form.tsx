"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

export function InviteMemberForm({ tripId }: { tripId: string }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Phase 2: real invite flow with email + magic links + RLS-safe membership insert.
    await new Promise((r) => setTimeout(r, 600))
    toast.success("Invite saved", {
      description: `We'll email ${email} when invites are wired up.`,
    })
    setEmail("")
    setLoading(false)
    void tripId
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
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
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
