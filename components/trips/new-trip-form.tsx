"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const SUGGESTED_COVERS = [
  "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80",
]

export function NewTripForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [cover, setCover] = useState(SUGGESTED_COVERS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (new Date(end) < new Date(start)) {
      setError("End date must be after start date")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not signed in")

      const { data, error: insertError } = await supabase
        .from("trips")
        .insert({
          name,
          destination: destination || null,
          start_date: start,
          end_date: end,
          cover_image_url: cover || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError
      toast.success("Trip created", { description: name })
      router.push(`/trips/${data.id}`)
      router.refresh()
    } catch (err: unknown) {
      console.error("[v0] Create trip error:", err)
      // Surface Supabase error details
      const supaErr = err as { message?: string; code?: string; details?: string; hint?: string }
      const msg = supaErr.message ?? (err instanceof Error ? err.message : "Unknown error")
      const details = [supaErr.code, supaErr.details, supaErr.hint].filter(Boolean).join(" | ")
      const fullMsg = details ? `${msg} (${details})` : msg
      setError(fullMsg)
      toast.error("Could not create trip", { description: fullMsg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border p-6">
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Trip name</FieldLabel>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tokyo Family Trip"
              className="rounded-xl"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="destination">Destination</FieldLabel>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Tokyo, Japan"
              className="rounded-xl"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="start">Start date</FieldLabel>
              <Input
                id="start"
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-xl"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="end">End date</FieldLabel>
              <Input
                id="end"
                type="date"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-xl"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="cover">Cover image</FieldLabel>
            <Input
              id="cover"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://..."
              className="rounded-xl"
            />
            <FieldDescription>Or pick one below.</FieldDescription>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {SUGGESTED_COVERS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setCover(url)}
                  className={`relative aspect-[3/2] overflow-hidden rounded-lg border-2 transition ${
                    cover === url ? "border-primary" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </Field>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => router.push("/trips")}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="mr-2 size-4" /> Creating...
                </>
              ) : (
                "Create trip"
              )}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </Card>
  )
}
