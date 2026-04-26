"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Spinner } from "@/components/ui/spinner"
import { updateTrip } from "@/app/actions/update-trip"
import { toast } from "sonner"
import type { Trip } from "@/lib/types"

export function EditTripDrawer({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(trip.name)
  const [destination, setDestination] = useState(trip.destination ?? "")
  const [start, setStart] = useState(trip.start_date)
  const [end, setEnd] = useState(trip.end_date)
  const [cover, setCover] = useState(trip.cover_image_url ?? "")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (new Date(end) < new Date(start)) {
      setError("End date must be after start date")
      return
    }

    setLoading(true)
    try {
      const { trip: updated } = await updateTrip(trip.id, {
        name,
        destination: destination || null,
        start_date: start,
        end_date: end,
        cover_image_url: cover || null,
      })

      toast.success("Trip updated", { description: name })
      onOpenChange(false)
      router.refresh()
    } catch (err: unknown) {
      console.error("[v0] Update trip error:", err)
      const supaErr = err as { message?: string; code?: string; details?: string; hint?: string }
      const msg = supaErr.message ?? (err instanceof Error ? err.message : "Unknown error")
      const details = [supaErr.code, supaErr.details, supaErr.hint].filter(Boolean).join(" | ")
      const fullMsg = details ? `${msg} (${details})` : msg
      setError(fullMsg)
      toast.error("Could not update trip", { description: fullMsg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:max-w-[512px]">
        <DrawerHeader>
          <DrawerTitle>Edit trip</DrawerTitle>
          <DrawerDescription>Update your trip details</DrawerDescription>
        </DrawerHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-6 px-6 pb-6">
          <FieldGroup>
            <FieldLabel htmlFor="name">Trip name</FieldLabel>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Tokyo Family Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FieldDescription>What&apos;s the name of your trip?</FieldDescription>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel htmlFor="destination">Destination</FieldLabel>
            <Input
              id="destination"
              type="text"
              placeholder="e.g., Tokyo, Japan"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <FieldDescription>Where are you going?</FieldDescription>
          </FieldGroup>

          <div className="grid grid-cols-2 gap-4">
            <FieldGroup>
              <FieldLabel htmlFor="start">Start date</FieldLabel>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="end">End date</FieldLabel>
              <Input
                id="end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </FieldGroup>
          </div>

          <FieldGroup>
            <FieldLabel htmlFor="cover">Cover image URL</FieldLabel>
            <Input
              id="cover"
              type="url"
              placeholder="https://..."
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
            <FieldDescription>Link to a cover photo for your trip</FieldDescription>
          </FieldGroup>

          {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

          <Button type="submit" disabled={loading} className="rounded-xl">
            {loading ? (
              <>
                <Spinner className="mr-2 size-4" /> Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
