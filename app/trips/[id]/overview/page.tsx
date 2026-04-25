import { Map } from "lucide-react"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { daysBetween, formatDayLabel, tripDuration } from "@/lib/dates"
import type { Activity, Trip } from "@/lib/types"

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).maybeSingle<Trip>()
  const { data: activities = [] } = await supabase
    .from("activities")
    .select("*")
    .eq("trip_id", id)
    .order("position", { ascending: true })

  if (!trip) return null

  const days = daysBetween(trip.start_date, trip.end_date)
  const duration = tripDuration(trip.start_date, trip.end_date)
  const total = (activities ?? []).length
  const travelDays = days.filter((d) => (activities ?? []).some((a: Activity) => a.day_date === d)).length
  const freeDays = duration - travelDays

  const stats = [
    { label: "Trip duration", value: `${duration} ${duration === 1 ? "day" : "days"}` },
    { label: "Total activities", value: String(total) },
    { label: "Travel days", value: String(travelDays) },
    { label: "Free days", value: String(freeDays) },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="tabular mt-2 font-serif text-3xl">{s.value}</div>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="font-serif text-2xl">Day-by-day</h2>
        <Card className="mt-4 rounded-2xl border-border">
          <ul className="divide-y divide-border">
            {days.map((d, idx) => {
              const dayActs = (activities ?? []).filter((a: Activity) => a.day_date === d)
              const titles = dayActs.slice(0, 2).map((a) => a.title).join(" · ")
              return (
                <li key={d} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Day {idx + 1}</span>
                    <span className="tabular text-sm">{formatDayLabel(d)}</span>
                  </div>
                  <div className="flex-1 text-sm text-muted-foreground">
                    {dayActs.length === 0 ? (
                      <span className="italic">Nothing planned yet</span>
                    ) : (
                      <span className="text-foreground">{titles}</span>
                    )}
                  </div>
                  <span className="tabular shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">
                    {dayActs.length}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Map</h2>
        <Card className="mt-4 flex aspect-[16/7] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Map className="h-5 w-5" aria-hidden />
            </span>
            <p className="font-serif text-lg">Map view</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pin every activity on a single map of your trip.
            </p>
            <span className="rounded-full bg-card px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </div>
        </Card>
      </section>
    </div>
  )
}
