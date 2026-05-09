"use client"

import { useState } from "react"
import { FileDown, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShareTripDialog } from "./share-trip-dialog"
import type { Trip } from "@/lib/types"

export function TripHeroActions({ trip, isOwner = false }: { trip: Trip; isOwner?: boolean }) {
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs"
          onClick={() => setShareOpen(true)}
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
