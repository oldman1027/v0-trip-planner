import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { differenceInDays } from "date-fns"
import { Plus, MapPin, Calendar, Hotel, Plane, Bus, Ticket, Utensils, ArrowRight, Star } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { TripCard } from "@/components/trips/trip-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/server"
import { normalizeMembers, type Trip, type Booking } from "@/lib/types"
import { formatRange, tripDuration, parseDateOnly } from "@/lib/dates"
import { cn } from "@/lib/utils"

// ─── helpers ───────────────────────────────────────────────────────────────

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

const BOOKING_META: Record<Booking["type"], { label: string; icon: React.ElementType }> = {
  accommodation: { label: "Accommodation", icon: Hotel },
  transport:     { label: "Transport",     icon: Bus },
  dining:        { label: "Dining",        icon: Utensils },
  activities:    { label: "Activity",      icon: Star },
  other:         { label: "Other",         icon: Ticket },
}

// ─── page ──────────────────────────────────────────────────────────────────

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams

  // If a PKCE code lands at / instead of /auth/callback, forward it.
  if (params.code) {
    const qs = new URLSearchParams(params).toString()
    redirect(`/auth/callback?${qs}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <MarketingPage />

  // Authenticated — build dashboard
  const displayName =
    (user.user_metadata as { full_name?: string })?.full_name ??
    user.email?.split("@")[0] ??
    "Traveler"

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: true })

  const tripIds = (trips ?? []).map((t) => t.id)

  const membersRaw = tripIds.length
    ? (
        await supabase
          .from("trip_members")
          .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
          .in("trip_id", tripIds)
      ).data
    : []

  const pendingRaw = tripIds.length
    ? (
        await supabase
          .from("bookings")
          .select("*")
          .in("trip_id", tripIds)
          .eq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(8)
      ).data
    : []

  const members = normalizeMembers(membersRaw)
  const pendingBookings = (pendingRaw ?? []) as Booking[]
  const tripMap = new Map((trips ?? []).map((t: Trip) => [t.id, t]))

  const today = new Date().toISOString().slice(0, 10)
  const upcomingTrip = (trips ?? []).find((t: Trip) => t.end_date >= today) ?? null
  const remainingTrips = (trips ?? []).filter((t: Trip) => t !== upcomingTrip)

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Welcome */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Welcome back</p>
            <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{displayName}</h1>
          </div>
          <Button asChild className="rounded-xl">
            <Link href="/trips/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New trip
            </Link>
          </Button>
        </div>

        {/* Upcoming / ongoing trip */}
        {upcomingTrip && (
          <section className="mb-10">
            <h2 className="mb-4 font-serif text-2xl">
              {upcomingTrip.start_date <= today ? "Current trip" : "Next up"}
            </h2>
            <UpcomingTripCard
              trip={upcomingTrip}
              members={members.filter((m) => m.trip_id === upcomingTrip.id)}
              today={today}
            />
          </section>
        )}

        {/* Pending bookings */}
        {pendingBookings.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-serif text-2xl">Needs attention</h2>
            <PendingSection bookings={pendingBookings} tripMap={tripMap} />
          </section>
        )}

        {/* All other trips */}
        {(trips ?? []).length === 0 ? (
          <EmptyDashboard />
        ) : remainingTrips.length > 0 ? (
          <section>
            <h2 className="mb-4 font-serif text-2xl">All trips</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {remainingTrips.map((t: Trip) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  members={members.filter((m) => m.trip_id === t.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

// ─── sub-components ────────────────────────────────────────────────────────

function UpcomingTripCard({
  trip,
  members,
  today,
}: {
  trip: Trip
  members: Array<{ user_id: string; profile: { full_name: string | null; avatar_url: string | null } | null }>
  today: string
}) {
  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80"
  const duration = tripDuration(trip.start_date, trip.end_date)
  const isOngoing = trip.start_date <= today && trip.end_date >= today
  const dayNumber = isOngoing
    ? differenceInDays(parseDateOnly(today), parseDateOnly(trip.start_date)) + 1
    : null
  const daysUntil = !isOngoing
    ? differenceInDays(parseDateOnly(trip.start_date), parseDateOnly(today))
    : null

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative h-52 w-full overflow-hidden md:h-64">
        <Image
          src={cover || "/placeholder.svg"}
          alt={`${trip.name} cover`}
          fill
          sizes="(min-width: 1024px) 75vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute left-4 top-4">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isOngoing
                ? "bg-primary text-primary-foreground"
                : "bg-white/90 text-foreground",
            )}
          >
            {isOngoing ? `Day ${dayNumber} of ${duration}` : `${daysUntil}d to go`}
          </span>
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <h3 className="font-serif text-3xl tracking-tight text-white">{trip.name}</h3>
          {trip.destination ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {trip.destination}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {formatRange(trip.start_date, trip.end_date)}
          </div>
          <div>
            {duration} {duration === 1 ? "day" : "days"}
          </div>
        </div>
        {members.length > 0 ? (
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m, i) => (
              <Avatar
                key={m.user_id}
                className="h-7 w-7 border-2 border-card"
                style={{ zIndex: 5 - i }}
              >
                {m.profile?.avatar_url ? (
                  <AvatarImage src={m.profile.avatar_url} alt={m.profile.full_name ?? ""} />
                ) : null}
                <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                  {(m.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

function PendingSection({
  bookings,
  tripMap,
}: {
  bookings: Booking[]
  tripMap: Map<string, Trip>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {bookings.map((b) => {
          const trip = tripMap.get(b.trip_id)
          const meta = BOOKING_META[b.type] ?? BOOKING_META.other
          const Icon = meta.icon
          return (
            <li key={b.id}>
              <Link
                href={`/trips/${b.trip_id}/bookings`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div className="truncate font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {trip?.name ?? "Trip"} · {meta.label}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {b.amount != null ? (
                    <span className="tabular text-sm font-medium">
                      {fmtMoney(b.amount, b.currency ?? "USD")}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                    pending
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
        <MapPin className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="font-serif text-2xl">No trips yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Plan your first adventure. Build an itinerary, track bookings, and share with your group.
        </p>
      </div>
      <Button asChild className="mt-2 rounded-xl">
        <Link href="/trips/new">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Plan your first trip
        </Link>
      </Button>
    </div>
  )
}

// ─── marketing page (unauthenticated) ──────────────────────────────────────

function MarketingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingNav />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <MarketingFooter />
    </div>
  )
}

// ── Nav ────────────────────────────────────────────────────────────────────

function MarketingNav() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-serif text-xl tracking-tight">Tripletto</span>
      </Link>
      <nav className="flex items-center gap-4">
        <a href="#features" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
          Features
        </a>
        <a href="#pricing" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
          Pricing
        </a>
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild className="rounded-xl">
          <Link href="/login">Start free</Link>
        </Button>
      </nav>
    </header>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-24 pt-8 lg:grid-cols-2 lg:gap-16 lg:pt-16">
      <div className="flex flex-col gap-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          For families and friend groups
        </div>
        <h1 className="text-balance font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
          Stop managing your group trip in a WhatsApp thread.
        </h1>
        <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Tripletto brings your whole group onto one shared itinerary — with an AI planner, real-time collaboration, and everything from bookings to costs in one place.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-xl">
            <Link href="/login">
              Start planning for free
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-xl">
            <a href="#how-it-works">See how it works ↓</a>
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Already used by travelers planning trips across Thailand, Malaysia &amp; Japan.
          </p>
          <p className="text-xs text-muted-foreground/70">No credit card required</p>
        </div>
      </div>

      <div className="relative">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src="https://images.unsplash.com/photo-1589685523979-6544ec36b055?w=900&q=80"
              alt="Kangaroo on Lucky Bay beach, Western Australia"
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
    </section>
  )
}

// ── How It Works ───────────────────────────────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    emoji: "🗺️",
    step: "1",
    title: "Create your trip",
    desc: "Add your destination, dates, and invite your group in seconds. Everyone's in — no app downloads required.",
  },
  {
    emoji: "📋",
    step: "2",
    title: "Plan together",
    desc: "Build your day-by-day itinerary on a shared board. The AI suggests activities, spots scheduling conflicts, and shows drive times between stops.",
  },
  {
    emoji: "✈️",
    step: "3",
    title: "Travel without chaos",
    desc: "Everyone sees the same plan, in real time. Bookings, costs, and even who owes who — all in one place.",
  },
]

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-4xl tracking-tight">How It Works</h2>
          <p className="mt-3 text-muted-foreground">Three steps to your best trip yet.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map(({ emoji, step, title, desc }) => (
            <div key={step} className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-3xl shadow-sm">
                {emoji}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Step {step}
                </div>
                <h3 className="font-serif text-xl">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Features ───────────────────────────────────────────────────────────────

const MARKETING_FEATURES = [
  {
    emoji: "🤖",
    title: "AI trip planner",
    desc: "Describe your vibe and it builds your day. Ask 'what to do in Chiang Mai on a rainy afternoon' and get real suggestions added straight to your itinerary.",
    featured: true,
  },
  {
    emoji: "👥",
    title: "Real-time group board",
    desc: "Your whole group sees every change the moment it happens. No more 'wait which version is the latest?' in the group chat.",
  },
  {
    emoji: "🏨",
    title: "Bookings tracker",
    desc: "Hotels, flights, restaurants — attach confirmation numbers, files, and links. Get a single timeline view of everything confirmed vs still pending.",
  },
  {
    emoji: "💰",
    title: "Costs & splitting",
    desc: "Log expenses in THB or MYR. See exactly who paid what and who owes who — settled per currency, no spreadsheet needed.",
  },
  {
    emoji: "📅",
    title: "Smart calendar view",
    desc: "See your whole day as a timeline. Drive times shown between stops so you know if that 30-minute gap is actually enough.",
  },
]

function FeaturesSection() {
  const [featured, ...rest] = MARKETING_FEATURES
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-4xl tracking-tight">Everything in one place</h2>
          <p className="mt-3 text-muted-foreground">
            No more juggling WhatsApp messages, spreadsheets, and voice notes.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Featured card — spans 2 columns */}
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-card p-6 sm:col-span-2 lg:col-span-2">
            <span className="text-3xl" aria-hidden>{featured.emoji}</span>
            <h3 className="font-serif text-xl">{featured.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{featured.desc}</p>
          </div>
          {rest.map(({ emoji, title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
            >
              <span className="text-3xl" aria-hidden>{emoji}</span>
              <h3 className="font-serif text-lg">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ────────────────────────────────────────────────────────────────

type PricingTier = {
  name: string
  price?: string
  description: string
  features: string[]
  recommended?: boolean
  comingSoon?: boolean
  ctaLabel?: string
  ctaHref?: string
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "Free forever",
    description: "Perfect for planning your first trip.",
    features: [
      "1 trip",
      "Up to 4 travelers",
      "Visual itinerary board & calendar",
      "Bookings tracker",
      "Cost splitting",
    ],
  },
  {
    name: "Pro",
    description: "For frequent travelers who need more.",
    features: [
      "Unlimited trips",
      "Unlimited travelers",
      "AI trip planner",
      "Export to PDF",
      "Priority email support",
    ],
    recommended: true,
    comingSoon: true,
    ctaLabel: "Notify me when Pro launches",
    ctaHref: "mailto:hello.tripletto@gmail.com?subject=Tripletto%20Pro%20-%20Early%20Access",
  },
  {
    name: "Team",
    description: "For agencies and large travel groups.",
    features: [
      "Everything in Pro",
      "Custom link sharing",
      "Team management dashboard",
      "Priority support",
      "Early access to new features",
    ],
    comingSoon: true,
    ctaLabel: "Contact us for early access",
    ctaHref: "mailto:hello.tripletto@gmail.com?subject=Tripletto%20Team%20-%20Early%20Access",
  },
]

function PricingSection() {
  return (
    <section id="pricing" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-4xl tracking-tight">Simple, honest pricing</h2>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.recommended
                  ? "relative flex flex-col gap-6 rounded-2xl border-2 border-primary bg-card p-6"
                  : "relative flex flex-col gap-6 rounded-2xl border border-border bg-card p-6"
              }
            >
              {tier.recommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Recommended
                  </span>
                </div>
              )}
              {tier.comingSoon && (
                <div className="absolute right-4 top-4">
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
              )}

              <div>
                <h3 className="font-serif text-xl">{tier.name}</h3>
                {tier.price && (
                  <div className="mt-2 font-serif text-2xl font-bold">{tier.price}</div>
                )}
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <ul className="flex flex-col gap-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {tier.comingSoon && tier.ctaHref ? (
                  <Button asChild className="w-full rounded-xl" variant="outline">
                    <a href={tier.ctaHref}>{tier.ctaLabel}</a>
                  </Button>
                ) : (
                  <Button asChild className="w-full rounded-xl">
                    <Link href="/login">Start for free</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────

function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-serif text-xl tracking-tight">Tripletto</span>
            </Link>
            <p className="text-sm text-muted-foreground">Plan together. Show up ready.</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Built by a traveler who got tired of managing trips across 10 WhatsApp messages, 3
              spreadsheets, and a voice note.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Product
            </h4>
            <nav className="flex flex-col gap-2">
              <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Pricing
              </a>
              <Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                About
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legal & Support
            </h4>
            <nav className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Terms of Service
              </Link>
              <a
                href="mailto:hello.tripletto@gmail.com"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Contact
              </a>
            </nav>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p className="text-center text-xs text-muted-foreground">
            © 2026 Tripletto. Made with ☀️ in Malaysia.
          </p>
        </div>
      </div>
    </footer>
  )
}
