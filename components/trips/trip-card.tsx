import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Trip } from "@/lib/types"
import { formatRange, tripDuration } from "@/lib/dates"

// Tripletto tropical palette — cycles across member avatars
const AVATAR_COLORS = ["#A9D6C5", "#F7A59E", "#6D8F87", "#8EC4B2"]

type MemberSlot = {
  user_id: string
  role?: string
  profile: { full_name: string | null; avatar_url: string | null } | null
}

export function TripCard({
  trip,
  members,
}: {
  trip: Trip
  members: MemberSlot[]
}) {
  const cover =
    trip.cover_image_url ??
    `https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80`
  const days = tripDuration(trip.start_date, trip.end_date)

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
        <Image
          src={cover || "/placeholder.svg"}
          alt={`${trip.name} cover`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {days} {days === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-serif text-2xl leading-tight tracking-tight">{trip.name}</h3>
          {trip.destination ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {trip.destination}
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <div className="tabular text-sm text-muted-foreground">{formatRange(trip.start_date, trip.end_date)}</div>
          {members.length > 0 ? <MemberStack members={members} /> : null}
        </div>
      </div>
    </Link>
  )
}

function MemberStack({ members }: { members: MemberSlot[] }) {
  // Owner always first, then by join order
  const sorted = [...members].sort((a, b) => {
    if (a.role === "owner") return -1
    if (b.role === "owner") return 1
    return 0
  })
  const visible = sorted.slice(0, 4)
  const extra = members.length - visible.length

  return (
    <div className="flex -space-x-2">
      {visible.map((m, i) => {
        const name = m.profile?.full_name ?? "?"
        return (
          <Avatar
            key={m.user_id}
            className="h-7 w-7 border-2 border-card"
            style={{ zIndex: visible.length - i }}
            title={name}
          >
            {m.profile?.avatar_url ? (
              <AvatarImage src={m.profile.avatar_url} alt={name} />
            ) : null}
            <AvatarFallback
              className="text-xs font-medium text-white"
              style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            >
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )
      })}
      {extra > 0 ? (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-xs text-muted-foreground"
          style={{ zIndex: 0 }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
