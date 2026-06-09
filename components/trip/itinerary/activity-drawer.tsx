"use client"

import { useEffect, useRef, useState } from "react"
import { Trash2, RefreshCw } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { LocationAutocomplete } from "./location-autocomplete"
import { Spinner } from "@/components/ui/spinner"
import { formatDayLabel, getBlockFromTime } from "@/lib/dates"
import type { Activity, Booking, TimeBlock } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CATEGORIES: { value: Activity["category"]; label: string }[] = [
  { value: "food",        label: "Food & Dining" },
  { value: "sightseeing", label: "Sightseeing" },
  { value: "transport",   label: "Transport" },
  { value: "hotel",       label: "Hotel / Stay" },
  { value: "activity",    label: "Activity" },
  { value: "other",       label: "Other" },
]

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.value))

function safeCategory(raw: string | null | undefined): Activity["category"] {
  return VALID_CATEGORIES.has(raw ?? "") ? (raw as Activity["category"]) : "other"
}

type State =
  | { mode: "create"; day_date: string; time_block: TimeBlock; start_time?: string }
  | { mode: "edit"; activity: Activity }
  | null

export function ActivityDrawer({
  state,
  days,
  currency,
  tripStart,
  tripEnd,
  linkedBooking,
  onClose,
  onSave,
  onDelete,
}: {
  state: State
  days: string[]
  currency: string
  tripStart: string
  tripEnd: string
  linkedBooking?: Booking | null
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
    category: Activity["category"]
    needs_booking: boolean
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const open = state !== null
  const formRef = useRef<HTMLFormElement>(null)
  const [title, setTitle] = useState("")
  const [day, setDay] = useState(days[0] ?? "")
  const [block, setBlock] = useState<TimeBlock>("morning")
  const [location, setLocation] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [cost, setCost] = useState("")
  const [photo, setPhoto] = useState("")
  const [category, setCategory] = useState<Activity["category"]>("other")
  const [needsBooking, setNeedsBooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchingPhoto, setFetchingPhoto] = useState(false)

  type Snapshot = {
    title: string; day: string; block: TimeBlock; location: string
    start: string; end: string; notes: string; cost: string
    photo: string; category: Activity["category"]; needsBooking: boolean
  }
  const originalRef = useRef<Snapshot | null>(null)

  const isDirty = originalRef.current !== null && (
    title !== originalRef.current.title ||
    day !== originalRef.current.day ||
    block !== originalRef.current.block ||
    location !== originalRef.current.location ||
    start !== originalRef.current.start ||
    end !== originalRef.current.end ||
    notes !== originalRef.current.notes ||
    cost !== originalRef.current.cost ||
    photo !== originalRef.current.photo ||
    category !== originalRef.current.category ||
    needsBooking !== originalRef.current.needsBooking
  )

  const dateError =
    day && (day < tripStart || day > tripEnd)
      ? "Activity must be within trip dates"
      : null

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  useEffect(() => {
    if (!state) return
    let snap: Snapshot
    if (state.mode === "create") {
      snap = {
        title: "", day: state.day_date, block: state.time_block,
        location: "", start: state.start_time ? state.start_time.slice(0, 5) : "",
        end: "", notes: "", cost: "", photo: "", category: "other", needsBooking: false,
      }
    } else {
      const a = state.activity
      snap = {
        title: a.title,
        day: a.day_date ?? days[0] ?? "",
        block: a.time_block ?? "morning",
        location: a.location ?? "",
        start: (a.start_time ?? "").slice(0, 5),
        end: (a.end_time ?? "").slice(0, 5),
        notes: a.notes ?? "",
        cost: a.cost_amount != null ? String(a.cost_amount) : "",
        photo: a.photo_url ?? "",
        category: safeCategory(a.category),
        needsBooking: !!a.booking_id,
      }
    }
    originalRef.current = snap
    setTitle(snap.title)
    setDay(snap.day)
    setBlock(snap.block)
    setLocation(snap.location)
    setStart(snap.start)
    setEnd(snap.end)
    setNotes(snap.notes)
    setCost(snap.cost)
    setPhoto(snap.photo)
    setCategory(snap.category)
    setNeedsBooking(snap.needsBooking)
  }, [state])

  function handleStartChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setStart(value)
    if (value) {
      const suggested = getBlockFromTime(value)
      if (suggested !== block) {
        setBlock(suggested)
        if (state?.mode === "edit") {
          const label = suggested.charAt(0).toUpperCase() + suggested.slice(1)
          toast.info(`Moved to ${label} block`, { duration: 2000 })
        }
      }
    }
  }

  async function fetchPlacePhoto(query: string): Promise<string | null> {
    try {
      if (typeof google === "undefined") return null
      const { Place } = await (google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>)
      const { places } = await Place.searchByText({ textQuery: query, fields: ["photos"], maxResultCount: 1 })
      if (places.length > 0 && places[0].photos && places[0].photos.length > 0) {
        return places[0].photos[0].getURI({ maxWidth: 800 })
      }
      return null
    } catch {
      return null
    }
  }

  async function handleRefreshPhoto() {
    if (!title.trim()) return
    setFetchingPhoto(true)
    try {
      const query = location.trim() ? `${title.trim()} ${location.trim()}` : title.trim()
      const url = await fetchPlacePhoto(query)
      if (url) {
        setPhoto(url)
        toast.success("Photo updated")
      } else {
        toast.error("No photo found for this activity")
      }
    } finally {
      setFetchingPhoto(false)
    }
  }

  async function performSave() {
    if (!state) return
    let resolvedPhoto = photo.trim() || null
    if (state.mode === "create" && !resolvedPhoto && title.trim()) {
      const query = location.trim() ? `${title.trim()} ${location.trim()}` : title.trim()
      resolvedPhoto = await fetchPlacePhoto(query)
    }
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
      photo_url: resolvedPhoto,
      category: safeCategory(category),
      needs_booking: needsBooking,
    })
  }

  function extractErrMsg(err: unknown): string {
    if (!err) return "Unknown error"
    if (err instanceof Error) return err.message
    if (typeof err === "object" && "message" in err) return String((err as { message: unknown }).message)
    return String(err)
  }

  async function handleOpenChange(v: boolean) {
    if (v || saving || deleting) return
    if (!isDirty) { onClose(); return }
    if (!title.trim()) {
      toast.error("Activity needs a title to be saved")
      return
    }
    if (dateError) {
      toast.error("Fix the date error before closing")
      return
    }
    setSaving(true)
    try {
      await performSave()
      toast.success("Changes saved", { duration: 2000 })
      onClose()
    } catch (err) {
      console.error("[drawer] save error:", err)
      toast.error("Could not save activity", { description: extractErrMsg(err) })
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!state) return
    setSaving(true)
    try {
      await performSave()
      onClose()
    } catch (err) {
      console.error("[drawer] save error:", err)
      toast.error("Could not save activity", { description: extractErrMsg(err) })
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-serif text-2xl">
            {state?.mode === "edit" ? "Edit activity" : "Add activity"}
          </SheetTitle>
          <SheetDescription>{state ? formatDayLabel(day) : ""}</SheetDescription>
        </SheetHeader>

        <form ref={formRef} onSubmit={onSubmit} className="flex flex-1 flex-col">
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
                    <SelectTrigger id="day" className={cn("rounded-xl", dateError && "border-destructive")}>
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
                  {dateError && (
                    <p className="mt-1 text-xs text-destructive" role="alert">{dateError}</p>
                  )}
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
                    onChange={handleStartChange}
                    className="rounded-xl"
                  />
                  {start && (
                    <p className="mt-1 text-[11px] capitalize text-muted-foreground">
                      → {getBlockFromTime(start)} block
                    </p>
                  )}
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
                  onPhotoUrl={(url) => { if (url && !photo) setPhoto(url) }}
                  placeholder="Asakusa, Tokyo"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Select value={category} onValueChange={(v) => setCategory(v as Activity["category"])}>
                  <SelectTrigger id="category" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="cost">Cost ({currency})</FieldLabel>
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
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="photo">Photo URL</FieldLabel>
                  <button
                    type="button"
                    onClick={handleRefreshPhoto}
                    disabled={fetchingPhoto || !title.trim()}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={cn("h-3 w-3", fetchingPhoto && "animate-spin")} aria-hidden />
                    {fetchingPhoto ? "Fetching…" : "Fetch from Google"}
                  </button>
                </div>
                <Input
                  id="photo"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  className="rounded-xl"
                  placeholder="https://images.unsplash.com/..."
                />
              </Field>

              <Field>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/50 p-3 transition-colors hover:bg-secondary/40">
                  <input
                    type="checkbox"
                    checked={needsBooking}
                    onChange={(e) => setNeedsBooking(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-primary"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Requires a booking / reservation</span>
                    <span className="text-xs text-muted-foreground">
                      Auto-creates a linked entry in the Bookings tab
                    </span>
                  </div>
                </label>
                {needsBooking && state?.mode === "edit" && (
                  <div className="mt-2 flex items-center gap-1.5 pl-1">
                    {linkedBooking?.confirmation_number ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                        ✅ Booked · #{linkedBooking.confirmation_number}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        Pending — add confirmation # in Bookings
                      </span>
                    )}
                  </div>
                )}
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
              <Button type="submit" className="rounded-xl" disabled={saving || !title.trim() || !!dateError}>
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
