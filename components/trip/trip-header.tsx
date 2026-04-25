import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, MapPin, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatRange } from "@/lib/dates"
import type { Trip } from "@/lib/types"

type Member = {
  user_id: string
  role: "owner" | "editor" | "viewer"
  profile: { full_name: string | null; avatar_url: string | null } | null
}

export function TripHeader({ trip, members }: { trip: Trip; members: Member[] }) {
  const cover =
    trip.cover_image_url ??
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80"

  return (
    <section className="relative">
      <div className="relative h-56 w-full overflow-hidden md:h-72">
        <Image src={cover || "/placeholder.svg"} alt={`${trip.name} cover`} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
      </div>

      <div className="mx-auto -mt-20 w-full max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card/95 p-6 shadow-md backdrop-blur">
          <div className="flex flex-col gap-2">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              All trips
            </Link>
            <h1 className="font-serif text-3xl tracking-tight md:text-4xl">{trip.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {trip.destination ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {trip.destination}
                </span>
              ) : null}
              <span className="tabular">{formatRange(trip.start_date, trip.end_date)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MemberStack members={members} />
            <Button className="rounded-xl">
              <UserPlus className="mr-2 h-4 w-4" aria-hidden />
              Invite
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function MemberStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 4)
  const extra = members.length - visible.length
  return (
    <div className="flex -space-x-2">
      {visible.map((m, i) => {
        const name = m.profile?.full_name ?? "?"
        return (
          <Avatar key={m.user_id} className="h-8 w-8 border-2 border-card" style={{ zIndex: visible.length - i }}>
            {m.profile?.avatar_url ? <AvatarImage src={m.profile.avatar_url || "/placeholder.svg"} alt={name} /> : null}
            <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )
      })}
      {extra > 0 ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
