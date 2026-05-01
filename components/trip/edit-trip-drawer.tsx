"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { LocationAutocomplete } from "@/components/trip/itinerary/location-autocomplete"
import { updateTrip } from "@/app/actions/update-trip"
import { detectCurrencyFromDestination, COMMON_CURRENCIES } from "@/lib/currency"
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
  const [currency, setCurrency] = useState(trip.default_currency ?? "USD")
  const [start, setStart] = useState(trip.start_date)
  const [end, setEnd] = useState(trip.end_date)
  const [cover, setCover] = useState(trip.cover_image_url ?? "")

  function handleDestinationChange(value: string) {
    setDestination(value)
    const detected = detectCurrencyFromDestination(value)
    setCurrency(detected)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (new Date(end) < new Date(start)) {
      setError("End date must be after start date")
      return
    }

    setLoading(true)
    try {
      await updateTrip(trip.id, {
        name,
        destination: destination || null,
        start_date: start,
        end_date: end,
        cover_image_url: cover || null,
        default_currency: currency,
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
      <DrawerContent className="flex max-h-[90svh] flex-col sm:max-w-[512px]">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Edit trip</DrawerTitle>
          <DrawerDescription>Update your trip details</DrawerDescription>
        </DrawerHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="flex flex-col gap-6 pb-4">
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
          </FieldGroup>

          <FieldGroup>
            <FieldLabel htmlFor="destination">Destination</FieldLabel>
            <LocationAutocomplete
              id="destination"
              value={destination}
              onChange={handleDestinationChange}
              placeholder="e.g., Tokyo, Japan"
            />
            <FieldDescription>Where are you going?</FieldDescription>
          </FieldGroup>

          <FieldGroup>
            <FieldLabel htmlFor="currency">Currency</FieldLabel>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Auto-detected from destination. You can override it.</FieldDescription>
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

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-6 py-4">
          <Button type="submit" disabled={loading} className="w-full rounded-xl">
            {loading ? (
              <>
                <Spinner className="mr-2 size-4" /> Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
