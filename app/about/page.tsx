import Link from "next/link"
import { MapPin, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "About — Tripletto",
  description: "The story behind Tripletto.",
}

export default function AboutPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-serif text-xl tracking-tight">Tripletto</span>
        </Link>
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>

        <h1 className="font-serif text-4xl tracking-tight">About Tripletto</h1>

        <div className="mt-10 flex flex-col gap-8 text-base leading-relaxed text-muted-foreground">
          <p className="text-lg">
            Tripletto was built by a traveler who got tired of managing trips across 10 WhatsApp
            messages, 3 spreadsheets, and a voice note.
          </p>

          <p>
            If you&apos;ve ever tried to plan a group trip, you know the pain. Someone books a hotel
            and shares a screenshot in the group chat. Someone else suggests a restaurant in a voice
            note no one can find. The budget is tracked in a Google Sheet that&apos;s three versions
            behind. By the time you actually get on the plane, half the group doesn&apos;t know
            what&apos;s happening.
          </p>

          <p>
            Tripletto puts everything in one place — itinerary, bookings, costs, and maps — and
            makes it collaborative from day one. Everyone in your travel group can see the plan,
            contribute to it, and know what&apos;s happening at a glance.
          </p>

          <p>
            It&apos;s designed for families planning a holiday, friend groups organising a trip
            abroad, and anyone who believes that the planning phase should be as enjoyable as the
            trip itself.
          </p>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="font-serif text-xl text-foreground">
              &ldquo;Plan together. Travel better.&rdquo;
            </p>
            <p className="mt-3">Built with ☀️ in Malaysia.</p>
          </div>

          <div className="flex flex-col gap-2">
            <p>Have feedback or questions? We&apos;d love to hear from you.</p>
            <a
              href="mailto:hello.tripletto@gmail.com"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              hello.tripletto@gmail.com
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
