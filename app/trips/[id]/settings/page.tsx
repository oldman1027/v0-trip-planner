import { Card } from "@/components/ui/card"
import { CollaboratorsSection } from "@/components/trip/collaborators-section"
import { createClient } from "@/lib/supabase/server"
import { daysBetween, formatDayLabel } from "@/lib/dates"
import { normalizeMembers, type Activity, type Trip, type TripInvitation } from "@/lib/types"

export default async function TripSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: { user } },
    { data: trip },
    { data: membersRaw },
    { data: activities },
    { data: pendingInvitations },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    supabase
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, last_activity_at, invited_by_user_id, profile:profiles(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id),
    supabase.from("activities").select("*").eq("trip_id", id),
    supabase
      .from("trip_invitations")
      .select("*")
      .eq("trip_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ])

  if (!trip || !user) return null
  let members = normalizeMembers(membersRaw)

  // If the trip creator isn't in trip_members (can happen with older trips),
  // synthesize an owner entry so the collaborators list is never empty.
  const creatorInMembers = members.some((m) => m.user_id === trip.created_by)
  if (!creatorInMembers) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, created_at")
      .eq("id", trip.created_by)
      .maybeSingle()
    members = [
      {
        trip_id: id,
        user_id: trip.created_by,
        role: "owner" as const,
        joined_at: trip.created_at,
        last_activity_at: null,
        invited_by_user_id: null,
        profile: creatorProfile ?? null,
      },
      ...members,
    ]
  }

  const isOwner = members.find((m) => m.user_id === user.id)?.role === "owner"

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
      <CollaboratorsSection
        tripId={id}
        tripName={trip.name}
        currentUserId={user.id}
        isOwner={isOwner}
        initialMembers={members}
        initialPendingInvitations={(pendingInvitations ?? []) as TripInvitation[]}
      />

      <div className="flex flex-col gap-6">
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
