"use client"

import { useState } from "react"
import { FileDown, Link as LinkIcon, Mail, MessageCircle, Send, Share2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ShareTripDialog } from "./share-trip-dialog"
import type { Trip } from "@/lib/types"

function isTokenValid(trip: Trip): boolean {
  if (!trip.share_token || !trip.is_public) return false
  if (!trip.share_token_expires_at) return true // no expiry set = treat as valid
  return new Date(trip.share_token_expires_at) > new Date()
}

export function TripHeroActions({ trip, isOwner = false }: { trip: Trip; isOwner?: boolean }) {
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(
    isTokenValid(trip) ? trip.share_token : null,
  )
  const [actionLoading, setActionLoading] = useState(false)

  async function getOrCreateToken(): Promise<string> {
    if (shareToken) return shareToken
    const res = await fetch(`/api/trips/${trip.id}/share`, { method: "POST" })
    if (!res.ok) throw new Error("Failed to generate link")
    const { token } = await res.json() as { token: string }
    setShareToken(token)
    return token
  }

  function buildShareUrl(token: string) {
    return `${window.location.origin}/view/${trip.id}?token=${token}`
  }

  async function handleCopyLink() {
    setActionLoading(true)
    try {
      const token = await getOrCreateToken()
      await navigator.clipboard.writeText(buildShareUrl(token))
      toast.success("Link copied! Valid for 30 days.")
    } catch {
      toast.error("Could not generate link. Try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleWhatsApp() {
    setActionLoading(true)
    try {
      const token = await getOrCreateToken()
      const url = buildShareUrl(token)
      const text = encodeURIComponent(`Check out our trip — ${trip.name}: ${url}`)
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Could not generate link. Try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleTelegram() {
    setActionLoading(true)
    try {
      const token = await getOrCreateToken()
      const url = encodeURIComponent(buildShareUrl(token))
      const text = encodeURIComponent(`Check out our trip — ${trip.name}`)
      window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Could not generate link. Try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRevoke() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/share`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setShareToken(null)
      toast.success("Read-only link revoked.")
    } catch {
      toast.error("Could not revoke link. Try again.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={actionLoading}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleCopyLink} disabled={actionLoading}>
              <LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              Copy read-only link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleWhatsApp} disabled={actionLoading}>
              <MessageCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              Share to WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleTelegram} disabled={actionLoading}>
              <Send className="mr-2 h-4 w-4 text-muted-foreground" />
              Share to Telegram
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
              Invite collaborator
            </DropdownMenuItem>
            {isOwner && shareToken && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleRevoke}
                  disabled={actionLoading}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Revoke read-only link
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs"
          disabled
          title="Coming soon"
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Export
        </Button>
      </div>

      <ShareTripDialog
        tripId={trip.id}
        tripName={trip.name}
        isOwner={isOwner}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  )
}
