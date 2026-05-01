"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Map, Share2, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { shareTrip } from "@/app/actions/share-trip"
import type { Trip } from "@/lib/types"

export function TripHeroActions({ trip }: { trip: Trip }) {
  const [isPending, startTransition] = useTransition()

  function handleShare() {
    startTransition(async () => {
      try {
        const token = await shareTrip(trip.id)
        const url = `${window.location.origin}/trip/public/${token}`
        await navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
      } catch {
        toast.error("Failed to share trip")
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" asChild>
        <Link href={`/trips/${trip.id}/overview`}>
          <Map className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Map
        </Link>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-lg px-3 text-xs"
        onClick={handleShare}
        disabled={isPending}
      >
        <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Share
      </Button>

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
  )
}
