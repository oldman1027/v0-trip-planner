"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { LocationAutocomplete } from "./location-autocomplete"
import { Spinner } from "@/components/ui/spinner"
import { formatDayLabel } from "@/lib/dates"
import type { Activity, TimeBlock } from "@/lib/types"
import { toast } from "sonner"

type State =
  | { mode: "create"; day_date: string; time_block: TimeBlock }
  | { mode: "edit"; activity: Activity }
  | null

export function ActivityDrawer({
  state,
  days,
  onClose,
  onSave,
  onDelete,
}: {
  state: State
  days: string[]
  onClose: () => void
  onSave: (input: {
    id?: string
    day_date: string
    time_block: TimeBlock
    title: string
    location: string | null
    start_time: string | null
    end_time: string | null
    notes: string | null
    cost_amount: number | null
    photo_url: string | null
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const open = state !== null
  const [title, setTitle] = useState("")
  const [day, setDay] = useState(days[0] ?? "")
  const [block, setBlock] = useState<TimeBlock>("morning")
  const [location, setLocation] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [cost, setCost] = useState("")
  const [photo, setPhoto] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!state) return
    if (state.mode === "create") {
      setTitle("")
      setDay(state.day_date)
      setBlock(state.time_block)
      setLocation("")
      setStart("")
      setEnd("")
      setNotes("")
      setCost("")
      setPhoto("")
    } else {
      const a = state.activity
      setTitle(a.title)
      setDay(a.day_date ?? days[0] ?? "")
      setBlock(a.time_block ?? "morning")
      setLocation(a.location ?? "")
      setStart((a.start_time ?? "").slice(0, 5))
      setEnd((a.end_time ?? "").slice(0, 5))
      setNotes(a.notes ?? "")
      setCost(a.cost_amount != null ? String(a.cost_amount) : "")
      setPhoto(a.photo_url ?? "")
    }
  }, [state])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!state) return
    setSaving(true)
    try {
      await onSave({
        id: state.mode === "edit" ? state.activity.id : undefined,
        day_date: day,
        time_block: block,
        title: title.trim(),
        location: location.trim() || null,
        start_time: start || null,
        end_time: end || null,
        notes: notes.trim() || null,
        cost_amount: cost ? Number(cost) : null,
        photo_url: photo.trim() || null,
      })
      onClose()
    } catch (err) {
      toast.error("Could not save activity", { description: err instanceof Error ? err.message : "Unknown" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!state || state.mode !== "edit") return
    setDeleting(true)
    try {
      await onDelete(state.activity.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-serif text-2xl">
            {state?.mode === "edit" ? "Edit activity" : "Add activity"}
          </SheetTitle>
          <SheetDescription>{state ? formatDayLabel(day) : ""}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 px-4 py-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                  placeholder="Senso-ji temple"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="day">Day</FieldLabel>
                  <Select value={day} onValueChange={setDay}>
                    <SelectTrigger id="day" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d, i) => (
                        <SelectItem key={d} value={d}>
                          Day {i + 1} · {formatDayLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="block">Time of day</FieldLabel>
                  <Select value={block} onValueChange={(v) => setBlock(v as TimeBlock)}>
                    <SelectTrigger id="block" className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="start">Start</FieldLabel>
                  <Input
                    id="start"
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="end">End</FieldLabel>
                  <Input
                    id="end"
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <LocationAutocomplete
                  id="location"
                  value={location}
                  onChange={setLocation}
                  placeholder="Asakusa, Tokyo"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="cost">Cost (USD)</FieldLabel>
                <Input
                  id="cost"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="photo">Photo URL</FieldLabel>
                <Input
                  id="photo"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  className="rounded-xl"
                  placeholder="https://images.unsplash.com/..."
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="rounded-xl"
                  placeholder="Reservation under family name."
                />
              </Field>
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-card p-4">
            {state?.mode === "edit" ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving || !title.trim()}>
                {saving ? (
                  <>
                    <Spinner className="mr-2 size-4" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
          <Label htmlFor="title" className="sr-only">
            Activity title
          </Label>
        </form>
      </SheetContent>
    </Sheet>
  )
}
