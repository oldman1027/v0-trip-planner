import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { NewTripForm } from "@/components/trips/new-trip-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewTripPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href="/trips"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to trips
        </Link>
        <h1 className="font-serif text-4xl tracking-tight">New trip</h1>
        <p className="mt-2 text-muted-foreground">Where to?</p>
        <div className="mt-8">
          <NewTripForm />
        </div>
      </main>
    </div>
  )
}
