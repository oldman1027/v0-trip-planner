import { createClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function verifyMembership(tripId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, member: null }
  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle()
  return { user, member }
}

// POST — generate or refresh read-only share token (any member can generate)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, member } = await verifyMembership(id)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from("trips")
    .update({
      share_token: token,
      share_token_expires_at: expiresAt.toISOString(),
      is_public: true,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
}

// DELETE — revoke share token (owner only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, member } = await verifyMembership(id)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (member?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from("trips")
    .update({ share_token: null, share_token_expires_at: null, is_public: false })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
