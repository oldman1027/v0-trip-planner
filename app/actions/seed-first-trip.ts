"use server"

import { getSeed } from "@/lib/seed"
import { createClient } from "@/lib/supabase/server"

export async function seedFirstTripIfNeeded() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Check if user has any trips
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id")
    .eq("created_by", user.id)
    .limit(1)

  if (tripsError) {
    console.error("[v0] Error checking trips:", tripsError)
    throw tripsError
  }

  // If they have trips, don't seed
  if (trips && trips.length > 0) {
    return { tripId: null, isNew: false }
  }

  // Seed the sample trip
  try {
    const seed = getSeed()
    const { data: tripData, error: tripError } = await supabase
      .from("trips")
      .insert({
        name: seed.trip.name,
        destination: seed.trip.destination,
        start_date: seed.trip.start_date,
        end_date: seed.trip.end_date,
        cover_image_url: seed.trip.cover_image_url,
        created_by: user.id,
        is_sample: true,
      })
      .select("id")
      .single()

    if (tripError) {
      console.error("[v0] Error creating sample trip:", tripError)
      throw tripError
    }

    const tripId = tripData.id

    // Insert activities
    if (seed.activities.length > 0) {
      const { error: activitiesError } = await supabase
        .from("activities")
        .insert(seed.activities.map((a) => ({ ...a, trip_id: tripId })))

      if (activitiesError) {
        console.error("[v0] Error inserting activities:", activitiesError)
        throw activitiesError
      }
    }

    // Insert bookings
    if (seed.bookings.length > 0) {
      const { error: bookingsError } = await supabase
        .from("bookings")
        .insert(seed.bookings.map((b) => ({ ...b, trip_id: tripId })))

      if (bookingsError) {
        console.error("[v0] Error inserting bookings:", bookingsError)
        throw bookingsError
      }
    }

    return { tripId, isNew: true }
  } catch (error) {
    console.error("[v0] Seed first trip error:", error)
    throw error
  }
}
