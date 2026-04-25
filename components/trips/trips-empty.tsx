"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import { getSeed } from "@/lib/seed"
import { toast } from "sonner"

export function TripsEmpty() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function seed() {
    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not signed in")

      const { trip, activities, bookings } = getSeed()

      const { data: created, error: tripErr } = await supabase
        .from("trips")
        .insert({
          name: trip.name,
          destination: trip.destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
          cover_image_url: trip.cover_image_url,
          created_by: user.id,
        })
        .select()
        .single()

      if (tripErr || !created) throw tripErr ?? new Error("Could not create trip")

      const tripId = created.id

      const { error: actErr } = await supabase
        .from("activities")
        .insert(activities.map((a) => ({ ...a, trip_id: tripId })))
      if (actErr) throw actErr

      const { error: bkErr } = await supabase
        .from("bookings")
        .insert(bookings.map((b) => ({ ...b, trip_id: tripId })))
      if (bkErr) throw bkErr

      toast.success("Sample trip created", { description: "Tokyo Family Trip is ready to explore." })
      router.push(`/trips/${tripId}`)
      router.refresh()
    } catch (err: unknown) {
      console.error("[v0] Create sample trip error:", err)
      // Surface Supabase error details
      const supaErr = err as { message?: string; code?: string; details?: string; hint?: string }
      const msg = supaErr.message ?? (err instanceof Error ? err.message : "Unknown error")
      const details = [supaErr.code, supaErr.details, supaErr.hint].filter(Boolean).join(" | ")
      const fullMsg = details ? `${msg} (${details})` : msg
      toast.error("Could not create sample trip", { description: fullMsg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-secondary text-primary">
          <Sparkles className="h-6 w-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">Plan your first trip</EmptyTitle>
        <EmptyDescription className="max-w-md">
          A trip is one shared timeline for your group. Create your own, or load a sample Tokyo trip to see how it
          feels.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-xl">
            <Link href="/trips/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New trip
            </Link>
          </Button>
          <Button variant="outline" className="rounded-xl bg-transparent" onClick={seed} disabled={loading}>
            {loading ? (
              <>
                <Spinner className="mr-2 size-4" /> Loading sample...
              </>
            ) : (
              "Try sample trip"
            )}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
