"use client"

import { MoreVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteTrip } from "@/app/actions/delete-trip"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function TripActionsMenu({ tripId, isSample }: { tripId: string; isSample?: boolean }) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(isSample ? "Delete this sample trip?" : "Delete this trip?")) return

    try {
      await deleteTrip(tripId)
      toast.success(isSample ? "Sample trip deleted" : "Trip deleted")
      router.push("/trips")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete trip"
      toast.error("Could not delete trip", { description: msg })
      console.error("[v0] Delete trip error:", err)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          {isSample ? "Delete sample trip" : "Delete trip"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
