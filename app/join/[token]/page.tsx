import { redirect } from "next/navigation"
import { joinTrip } from "@/app/actions/join-trip"

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await joinTrip(token)

  if (result.status === "unauthenticated") {
    redirect(`/login?next=/join/${token}`)
  }

  if (result.status === "invalid_token") {
    redirect("/trips?error=invalid_link")
  }

  // success or already_member — both land on the group page
  redirect(`/trips/${result.tripId}/group`)
}
