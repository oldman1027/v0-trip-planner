import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/trips")

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-serif text-xl tracking-tight">Trip Planner</span>
        </Link>
        <nav className="flex items-center gap-2">
          {/* AUTH DISABLED FOR DEV: Sign in buttons hidden */}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-24 pt-8 lg:grid-cols-2 lg:gap-16 lg:pt-16">
        <div className="flex flex-col gap-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            For families and friend groups
          </div>
          <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Plan trips together,
            <br />
            <span className="text-primary">not in WhatsApp.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            One visual timeline for the whole crew. Drag activities into morning, afternoon, or night. See bookings,
            members, and budget — without scrolling through 300 messages.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* AUTH DISABLED FOR DEV: CTA buttons redirected to /trips */}
            <Button asChild size="lg" className="rounded-xl">
              <Link href="/trips">Get started</Link>
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-6 pt-4">
            <Stat label="Visual itinerary" value="Drag &amp; drop" />
            <Stat label="Shared with" value="Your group" />
            <Stat label="Replaces" value="The chat" />
          </dl>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1400&q=80"
                alt="Tokyo skyline at dusk with neon signs"
                fill
                className="object-cover"
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>
            <div className="border-t border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif text-lg">Tokyo Family Trip</div>
                  <div className="text-sm text-muted-foreground">7 days · 4 travelers</div>
                </div>
                <div className="flex -space-x-2">
                  {["A", "M", "K", "S"].map((c, i) => (
                    <span
                      key={c}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-medium text-secondary-foreground"
                      style={{ zIndex: 4 - i }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card p-4 shadow-md md:block">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Day 3 · Afternoon</div>
            <div className="mt-1 font-medium">Shibuya Sky observation deck</div>
            <div className="text-sm text-muted-foreground">15:30 – 17:00</div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className="font-serif text-base text-foreground"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  )
}
