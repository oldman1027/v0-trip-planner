import { CollaboratorsSection } from "@/components/trip/collaborators-section"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { normalizeMembers, type Trip, type TripInvitation } from "@/lib/types"

export default async function TripSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // Service client bypasses the recursive RLS on trip_members
  // (trip_members_select calls is_trip_member which re-queries trip_members,
  // causing the policy to return 0 rows for all members including the owner).
  const serviceClient = await createServiceClient()

  const [
    { data: { user } },
    { data: trip },
    { data: membersRaw },
    { data: pendingInvitations },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>(),
    serviceClient
      .from("trip_members")
      .select("trip_id, user_id, role, joined_at, last_activity_at, invited_by_user_id, profile:profiles!trip_members_user_id_profiles_fkey(id, full_name, avatar_url, created_at)")
      .eq("trip_id", id)
      .order("joined_at", { ascending: true }),
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
    const { data: creatorProfile } = await serviceClient
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

  return (
    <CollaboratorsSection
      tripId={id}
      tripName={trip.name}
      currentUserId={user.id}
      isOwner={isOwner}
      initialMembers={members}
      initialPendingInvitations={(pendingInvitations ?? []) as TripInvitation[]}
    />
  )
}
