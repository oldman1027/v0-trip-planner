"use client"

import { useState, useEffect, useTransition } from "react"
import { Check, Copy, Link as LinkIcon, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { inviteToTrip } from "@/app/actions/invite-to-trip"
import { createOrRefreshShareLink } from "@/app/actions/create-share-link"
import { getTripShareLink } from "@/lib/supabase/trip-shares"

interface ShareTripDialogProps {
  tripId: string
  tripName: string
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareTripDialog({ tripId, tripName, isOwner, open, onOpenChange }: ShareTripDialogProps) {
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const [joinLink, setJoinLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load existing share link when dialog opens
  useEffect(() => {
    if (!open) return
    getTripShareLink(tripId)
      .then((link) => {
        if (link) {
          setJoinLink(`${window.location.origin}/join/${link.token}`)
        }
      })
      .catch(() => {})
  }, [open, tripId])

  function handleInvite() {
    if (!email.trim()) return
    startTransition(async () => {
      const result = await inviteToTrip(tripId, email.trim())
      if (result.status === "success") {
        toast.success(`Invited ${result.memberName}`)
        setEmail("")
      } else if (result.status === "not_found") {
        toast.error("No account found with that email address")
      } else if (result.status === "already_member") {
        toast.info("That person is already a collaborator")
      } else if (result.status === "unauthorized") {
        toast.error("Only the trip owner can invite collaborators")
      } else {
        toast.error("Something went wrong — please try again")
      }
    })
  }

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const url = await createOrRefreshShareLink(tripId)
      setJoinLink(url)
    } catch {
      toast.error("Failed to generate link")
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share trip</DialogTitle>
          <DialogDescription>Invite collaborators to {tripName}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Invite by email
            </TabsTrigger>
            <TabsTrigger value="link">
              <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
              Join link
            </TabsTrigger>
          </TabsList>

          {/* ── Email tab ── */}
          <TabsContent value="email" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  disabled={isPending}
                />
                <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
                  {isPending ? <Spinner className="h-4 w-4" /> : "Invite"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Collaborators can view and edit the itinerary, bookings, and costs.
            </p>
          </TabsContent>

          {/* ── Join link tab ── */}
          <TabsContent value="link" className="space-y-4 pt-2">
            {joinLink ? (
              <div className="space-y-2">
                <Label>Collaborative join link</Label>
                <div className="flex gap-2">
                  <Input value={joinLink} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(joinLink)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                  >
                    {generatingLink ? (
                      <Spinner className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Regenerate link
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate a link anyone can click to join this trip as a collaborator.
                </p>
                {isOwner ? (
                  <Button onClick={handleGenerateLink} disabled={generatingLink} className="w-full">
                    {generatingLink ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" /> Generating…
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" /> Generate join link
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only the trip owner can generate a join link.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
