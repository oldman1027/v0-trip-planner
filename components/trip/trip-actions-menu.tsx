"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MoreVertical, Trash2, Pencil, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteTrip } from "@/app/actions/delete-trip"
import { EditTripDrawer } from "./edit-trip-drawer"
import { toast } from "sonner"
import type { Trip } from "@/lib/types"

export function TripActionsMenu({ trip, isSample, isOwner = false }: { trip: Trip; isSample?: boolean; isOwner?: boolean }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const handleDelete = async () => {
    if (!confirm(isSample ? "Delete this sample trip?" : "Delete this trip?")) return

    try {
      await deleteTrip(trip.id)
      toast.success(isSample ? "Sample trip deleted" : "Trip deleted")
      router.push("/trips")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete trip"
      toast.error("Could not delete trip", { description: msg })
      console.error("[v0] Delete trip error:", err)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/trips/${trip.id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit trip
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {isSample ? "Delete sample trip" : "Delete trip"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditTripDrawer trip={trip} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
