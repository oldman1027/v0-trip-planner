"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function TripsEmpty() {
  return (
    <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-secondary text-primary">
          <Plus className="h-6 w-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">Plan your first trip</EmptyTitle>
        <EmptyDescription className="max-w-md">
          Your itinerary, all in one place. Create a new trip to get started.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild className="rounded-xl">
          <Link href="/trips/new">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New trip
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
