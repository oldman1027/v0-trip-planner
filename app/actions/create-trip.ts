"use server"

import { createClient as createServerClientSSR } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function createTrip(payload: {
  name: string
  destination: string | null
  start_date: string
  end_date: string
  cover_image_url: string | null
}) {
  // First: get authenticated user from session cookies (SSR client)
  const cookieStore = await cookies()
  const { createServerClient } = await import("@supabase/ssr")
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // ignore
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  // Debug logging to diagnose RLS issues
  console.log("[create-trip] auth.uid will be:", user.id)
  console.log("[create-trip] payload created_by:", user.id)

  // Second: use service role client to perform the insert
  // RLS policies will check created_by = auth.uid() via the payload value
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("trips")
    .insert({
      ...payload,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Create trip error:", error)
    throw error
  }

  return { trip: data }
}
