"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutGrid, LayoutList, CalendarCheck, DollarSign,
  Share2, FileDown, History, ChevronLeft,
  Link as LinkIcon, MessageCircle, Send, Mail, Trash2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ShareTripDialog } from "./share-trip-dialog"
import { HistoryPanel } from "./history-panel"
import { UserMenu } from "@/components/user-menu"
import { NotificationsPopover } from "@/components/notifications-popover"
import { toast } from "sonner"
import type { Trip } from "@/lib/types"

const NAV_ITEMS = [
  { label: "Itinerary", slug: "",        icon: LayoutGrid },
  { label: "Overview",  slug: "overview", icon: LayoutList },
  { label: "Bookings",  slug: "bookings", icon: CalendarCheck },
  { label: "Costs",     slug: "costs",    icon: DollarSign },
]

function isTokenValid(trip: Trip): boolean {
  if (!trip.share_token || !trip.is_public) return false
  if (!trip.share_token_expires_at) return true
  return new Date(trip.share_token_expires_at) > new Date()
}

export function TripSidebarLayout({
  trip,
  totalBudget,
  isOwner,
  children,
}: {
  trip: Trip
  totalBudget: number
  isOwner: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = `/trips/${trip.id}`

  const [shareOpen, setShareOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(
    isTokenValid(trip) ? trip.share_token : null,
  )
  const [shareLoading, setShareLoading] = useState(false)

  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"

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
    setShareLoading(true)
    try {
      const token = await getOrCreateToken()
      await navigator.clipboard.writeText(buildShareUrl(token))
      toast.success("Link copied! Valid for 30 days.")
    } catch { toast.error("Could not generate link.") }
    finally { setShareLoading(false) }
  }

  async function handleWhatsApp() {
    setShareLoading(true)
    try {
      const token = await getOrCreateToken()
      const text = encodeURIComponent(`Check out our trip — ${trip.name}: ${buildShareUrl(token)}`)
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
    } catch { toast.error("Could not generate link.") }
    finally { setShareLoading(false) }
  }

  async function handleTelegram() {
    setShareLoading(true)
    try {
      const token = await getOrCreateToken()
      const url = encodeURIComponent(buildShareUrl(token))
      const text = encodeURIComponent(`Check out our trip — ${trip.name}`)
      window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank", "noopener,noreferrer")
    } catch { toast.error("Could not generate link.") }
    finally { setShareLoading(false) }
  }

  async function handleRevoke() {
    setShareLoading(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/share`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setShareToken(null)
      toast.success("Read-only link revoked.")
    } catch { toast.error("Could not revoke link.") }
    finally { setShareLoading(false) }
  }

  return (
    <div className="flex h-svh overflow-hidden">

      {/* ── LEFT SIDEBAR — icon-only, desktop only ────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-16 flex-shrink-0 bg-[#F7F3EE]"
        style={{ borderRight: "0.5px solid #D4C9BC" }}
      >
        {/* Back to trips */}
        <div className="flex justify-center py-4">
          <Link
            href="/trips"
            title="All trips"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2C4A45] hover:bg-[#EDE8E0] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 flex flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const href = item.slug ? `${base}/${item.slug}` : base
            const active = item.slug
              ? pathname === href || pathname.startsWith(href + "/")
              : pathname === base
            return (
              <Link
                key={item.label}
                href={href}
                title={item.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-[#6D8F87] text-white"
                    : "text-[#2C4A45] hover:bg-[#EDE8E0]",
                )}
              >
                <item.icon className="w-4 h-4" />
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div
          className="px-2 py-3 flex flex-col items-center gap-1"
          style={{ borderTop: "0.5px solid #D4C9BC" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Share"
                disabled={shareLoading}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <DropdownMenuItem onClick={handleCopyLink} disabled={shareLoading}>
                <LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                Copy read-only link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleWhatsApp} disabled={shareLoading}>
                <MessageCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                Share to WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTelegram} disabled={shareLoading}>
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
                    disabled={shareLoading}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Revoke read-only link
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            title="Export (coming soon)"
            disabled
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground/50 cursor-not-allowed"
          >
            <FileDown className="w-4 h-4" />
          </button>

          <button
            title="History"
            onClick={() => setHistoryOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── RIGHT CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Mobile top bar — hidden on desktop */}
        <header className="md:hidden sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-4 py-3">
          <Link href="/trips" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="Tripletto" width={28} height={28} className="rounded-md" />
            <span className="font-serif text-base tracking-tight">Tripletto</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationsPopover />
            <UserMenu />
          </div>
        </header>

        {/* Mobile hero — hidden on desktop */}
        <div className="md:hidden relative h-32 overflow-hidden flex-shrink-0">
          <Image src={cover} fill className="object-cover" alt={trip.name} sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60" />
          <h1 className="absolute bottom-3 left-4 text-white text-xl font-bold">{trip.name}</h1>
        </div>

        {/* Mobile tabs — hidden on desktop */}
        <div className="md:hidden flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto bg-background sticky top-[53px] z-40">
          {NAV_ITEMS.map((item) => {
            const href = item.slug ? `${base}/${item.slug}` : base
            const active = item.slug
              ? pathname === href || pathname.startsWith(href + "/")
              : pathname === base
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Tab content */}
        <main className="flex-1 overflow-auto bg-[#FFFBF4]">
          <div className="px-4 py-4 pb-16 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <ShareTripDialog
        tripId={trip.id}
        tripName={trip.name}
        isOwner={isOwner}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <HistoryPanel
        tripId={trip.id}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  )
}
