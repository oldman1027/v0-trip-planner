"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  MapPin, Calendar, DollarSign, LayoutGrid, LayoutList, CalendarCheck,
  Share2, FileDown, History, ChevronLeft,
  Link as LinkIcon, MessageCircle, Send, Mail, Trash2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatRange, tripDuration } from "@/lib/dates"
import { ShareTripDialog } from "./share-trip-dialog"
import { HistoryPanel } from "./history-panel"
import { UserMenu } from "@/components/user-menu"
import { NotificationsPopover } from "@/components/notifications-popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
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
  const duration = tripDuration(trip.start_date, trip.end_date)

  const [shareOpen, setShareOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(
    isTokenValid(trip) ? trip.share_token : null,
  )
  const [shareLoading, setShareLoading] = useState(false)
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatarUrl: string | null }>>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("trip_members")
      .select("user_id, profiles(full_name, avatar_url)")
      .eq("trip_id", trip.id)
      .then(({ data }) => {
        if (!data) return
        setMembers(
          (data as unknown as Array<{ user_id: string; profiles: { full_name: string | null; avatar_url: string | null } | null }>)
            .map((m) => ({
              id: m.user_id,
              name: m.profiles?.full_name ?? "?",
              avatarUrl: m.profiles?.avatar_url ?? null,
            }))
        )
      })
  }, [trip.id])

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

      {/* ── LEFT SIDEBAR — desktop only ──────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[30%] max-w-xs overflow-y-auto flex-shrink-0 bg-[#F7F3EE]" style={{ borderRight: "0.5px solid #D4C9BC" }}>

        {/* Hero image */}
        <div className="relative h-36 flex-shrink-0 overflow-hidden">
          <Image src={cover} fill className="object-cover" alt={trip.name} sizes="320px" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All trips
            </Link>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-white font-bold text-base leading-tight truncate">{trip.name}</p>
          </div>
        </div>

        {/* Trip meta */}
        <div className="px-4 py-3 space-y-2" style={{ borderBottom: "0.5px solid #D4C9BC" }}>
          {trip.destination && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatRange(trip.start_date, trip.end_date)} · {duration} {duration === 1 ? "day" : "days"}</span>
          </div>
          {totalBudget > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{fmtBudget(totalBudget, trip.default_currency)}</span>
            </div>
          )}
          {members.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <div className="flex -space-x-1.5">
                {members.slice(0, 4).map((m) => (
                  <Avatar key={m.id} className="h-7 w-7 border-2 border-[#F7F3EE]" title={m.name}>
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                    <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                      {m.name[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {members.length === 1
                  ? "1 member"
                  : `${members.length} members`}
                {members.length > 4 && ` (+${members.length - 4})`}
              </span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
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
                  "flex items-center gap-3 px-3 py-2 rounded-full text-sm font-medium transition-colors",
                  active
                    ? "bg-[#6D8F87] text-white"
                    : "text-[#2C4A45] hover:bg-[#EDE8E0]",
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: "0.5px solid #D4C9BC" }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={shareLoading}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Share2 className="w-4 h-4 flex-shrink-0" />
                Share
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
            disabled
            title="Coming soon"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed"
          >
            <FileDown className="w-4 h-4 flex-shrink-0" />
            Export
          </button>

          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <History className="w-4 h-4 flex-shrink-0" />
            History
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

function fmtBudget(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
