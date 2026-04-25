import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { InviteMemberForm } from "@/components/trip/group/invite-member-form"
import { createClient } from "@/lib/supabase/server"
import { daysBetween, formatDayLabel } from "@/lib/dates"
import { normalizeMembers, type Activity, type Trip } from "@/lib/types"

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: trip }, { data: membersRaw }, { data: activities }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    supabase
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, profile:profiles(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id),
    supabase.from("activities").select("*").eq("trip_id", id),
  ])

  if (!trip) return null
  const members = normalizeMembers(membersRaw)

  const days = daysBetween(trip.start_date, trip.end_date)
  const freeBlocks: Array<{ day: string; block: string }> = []
  const blocks: Array<"morning" | "afternoon" | "night"> = ["morning", "afternoon", "night"]
  for (const d of days) {
    for (const b of blocks) {
      const has = (activities ?? []).some((a: Activity) => a.day_date === d && a.time_block === b)
      if (!has) freeBlocks.push({ day: d, block: b })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="rounded-2xl border-border lg:col-span-2">
        <div className="border-b border-border p-5">
          <h2 className="font-serif text-2xl">Travelers</h2>
          <p className="text-sm text-muted-foreground">Who&apos;s on this trip.</p>
        </div>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const name = m.profile?.full_name ?? "Unnamed traveler"
            return (
              <li key={m.user_id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {m.profile?.avatar_url ? (
                      <AvatarImage src={m.profile.avatar_url || "/placeholder.svg"} alt={name} />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(m.joined_at as string).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full border-transparent bg-secondary text-primary capitalize"
                >
                  {m.role}
                </Badge>
              </li>
            )
          })}
          {members.length === 0 ? (
            <li className="p-5 text-sm text-muted-foreground">No members yet.</li>
          ) : null}
        </ul>
      </Card>

      <div className="flex flex-col gap-6">
        <InviteMemberForm tripId={id} />

        <Card className="rounded-2xl border-border">
          <div className="border-b border-border p-5">
            <h3 className="font-serif text-xl">Meetup blocks</h3>
            <p className="text-sm text-muted-foreground">Group-wide moments.</p>
          </div>
          <ul className="space-y-3 p-5 text-sm">
            <li className="rounded-lg bg-secondary/50 p-3">
              <div className="font-medium">Family dinner — Day 3, 7:30pm</div>
              <div className="text-xs text-muted-foreground">All members · Sushi at Numazuko</div>
            </li>
            <li className="rounded-lg bg-secondary/50 p-3">
              <div className="font-medium">Photo at Shibuya Sky — Day 3, 4pm</div>
              <div className="text-xs text-muted-foreground">All members</div>
            </li>
          </ul>
        </Card>

        <Card className="rounded-2xl border-border">
          <div className="border-b border-border p-5">
            <h3 className="font-serif text-xl">Free time</h3>
            <p className="text-sm text-muted-foreground">Unplanned blocks across the trip.</p>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto p-5 text-sm">
            {freeBlocks.length === 0 ? (
              <li className="text-muted-foreground">Every block is planned.</li>
            ) : (
              freeBlocks.slice(0, 8).map((f) => (
                <li key={`${f.day}-${f.block}`} className="flex items-center justify-between text-sm">
                  <span className="tabular text-muted-foreground">{formatDayLabel(f.day)}</span>
                  <span className="capitalize">{f.block}</span>
                </li>
              ))
            )}
            {freeBlocks.length > 8 ? (
              <li className="text-xs text-muted-foreground">+{freeBlocks.length - 8} more</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  )
}
