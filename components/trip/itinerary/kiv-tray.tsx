"use client"

import { useEffect, useRef, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Bookmark,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatDayLabel } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Activity, KIVNote } from "@/lib/types"

const CATEGORY_ICON: Record<Activity["category"], string> = {
  dining:        "🍽️",
  experiences:   "🎯",
  transport:     "✈️",
  accommodation: "🏨",
  other:         "📌",
}

// ── KIV Activity Card ─────────────────────────────────────────────────────────

function KIVActivityCard({
  activity,
  days,
  onAssignDay,
  onDelete,
}: {
  activity: Activity
  days: string[]
  onAssignDay: (activityId: string, day: string) => void
  onDelete: (activityId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
  })
  const [dayOpen, setDayOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/kiv relative flex shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-shadow",
        "w-[180px]",
        isDragging && "opacity-40 shadow-md ring-1 ring-primary/30",
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover/kiv:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="pl-3">
        <div className="flex items-start justify-between gap-1">
          <span className="text-base leading-none" aria-hidden>
            {CATEGORY_ICON[activity.category] ?? "📌"}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/kiv:opacity-100">
            <Popover open={dayOpen} onOpenChange={setDayOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Assign to a day"
                >
                  <CalendarPlus className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Assign to day
                </p>
                {days.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      onAssignDay(activity.id, day)
                      setDayOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
                  >
                    <span className="text-muted-foreground">Day {i + 1}</span>
                    <span className="truncate text-foreground">{formatDayLabel(day)}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => onDelete(activity.id)}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Remove from KIV"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug">{activity.title}</p>
        {activity.location && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{activity.location}</p>
        )}
      </div>
    </div>
  )
}

// ── KIV Note Card ─────────────────────────────────────────────────────────────

function KIVNoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: KIVNote
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onEdit(note.id, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex shrink-0 w-[200px] flex-col gap-1.5 rounded-xl border border-primary/30 bg-card p-2.5 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[64px] resize-none rounded-lg text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave()
            if (e.key === "Escape") { setDraft(note.content); setEditing(false) }
          }}
        />
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => { setDraft(note.content); setEditing(false) }}
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/note relative flex shrink-0 w-[200px] flex-col gap-1 rounded-xl border border-border bg-amber-50/60 px-3 py-2.5 shadow-sm dark:bg-amber-950/20">
      <StickyNote className="h-3 w-3 text-amber-500/70" />
      <p className="text-xs leading-snug text-foreground">{note.content}</p>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── Quick-add input ───────────────────────────────────────────────────────────

function QuickAddInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue("")
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-border bg-card/60 px-3 py-2.5 transition-colors w-[180px]",
        focused && "border-primary/40 bg-card",
      )}
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") { setValue(""); (e.target as HTMLInputElement).blur() }
        }}
        placeholder="Add idea…"
        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 min-w-0"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); submit() }}
          className="flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground"
        >
          <Check className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ── Add Note Input ────────────────────────────────────────────────────────────

function AddNoteInput({ onAdd }: { onAdd: (content: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-border bg-amber-50/40 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-amber-300/60 hover:bg-amber-50/60 dark:bg-amber-950/10 w-[160px]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add note
      </button>
    )
  }

  return (
    <div className="flex shrink-0 w-[220px] flex-col gap-1.5 rounded-xl border border-amber-300/60 bg-amber-50/60 p-2.5 dark:bg-amber-950/20">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Note…"
        className="min-h-[56px] resize-none rounded-lg text-xs bg-transparent border-0 p-0 focus-visible:ring-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
          if (e.key === "Escape") { setValue(""); setOpen(false) }
        }}
      />
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => { setValue(""); setOpen(false) }}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
        >
          <X className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── KIV Tray ──────────────────────────────────────────────────────────────────

export function KIVTray({
  tripId,
  activities,
  days,
  isOver: isOverProp,
  onAssignDay,
  onDelete,
  onAdd,
}: {
  tripId: string
  activities: Activity[]
  days: string[]
  isOver?: boolean
  onAssignDay: (activityId: string, day: string) => void
  onDelete: (activityId: string) => void
  onAdd: (title: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [notes, setNotes] = useState<KIVNote[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)

  const { setNodeRef, isOver } = useDroppable({ id: "kiv" })
  const isDropActive = isOver || isOverProp

  // Fetch notes on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("kiv_notes")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setNotes(data as KIVNote[])
        setNotesLoaded(true)
      })
  }, [tripId])

  async function handleAddNote(content: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from("kiv_notes")
      .insert({ trip_id: tripId, content, created_by: user?.id ?? null })
      .select()
      .single()
    if (error) { toast.error("Could not save note"); return }
    setNotes((prev) => [...prev, data as KIVNote])
  }

  async function handleEditNote(id: string, content: string) {
    const supabase = createClient()
    const { error } = await supabase.from("kiv_notes").update({ content }).eq("id", id)
    if (error) { toast.error("Could not update note"); return }
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, content } : n))
  }

  async function handleDeleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from("kiv_notes").delete().eq("id", id)
    if (error) { toast.error("Could not delete note") }
  }

  const totalCount = activities.length + notes.length
  const hasContent = activities.length > 0 || notes.length > 0

  return (
    <div className="mt-2">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left transition-colors hover:bg-secondary/50"
      >
        <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Keep in View</span>
        {totalCount > 0 && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {totalCount}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div
          ref={setNodeRef}
          className={cn(
            "mt-2 rounded-2xl border-2 border-dashed p-3 transition-colors",
            isDropActive
              ? "border-primary/40 bg-primary/5"
              : "border-border/60 bg-card/40",
          )}
        >
          {/* Activity row */}
          <div className="flex gap-2 overflow-x-auto pb-1.5">
            <SortableContext items={activities.map((a) => a.id)} strategy={rectSortingStrategy}>
              {activities.map((a) => (
                <KIVActivityCard
                  key={a.id}
                  activity={a}
                  days={days}
                  onAssignDay={onAssignDay}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
            <QuickAddInput onAdd={onAdd} />
          </div>

          {/* Notes row */}
          {(notesLoaded && (notes.length > 0 || true)) && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {notes.map((n) => (
                <KIVNoteCard
                  key={n.id}
                  note={n}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                />
              ))}
              <AddNoteInput onAdd={handleAddNote} />
            </div>
          )}

          {/* Empty drop hint */}
          {activities.length === 0 && !isDropActive && (
            <p className="mt-1 text-center text-[11px] text-muted-foreground/50">
              Drag activities here to save for later
            </p>
          )}
        </div>
      )}
    </div>
  )
}
