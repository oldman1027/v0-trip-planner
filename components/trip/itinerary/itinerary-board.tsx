"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DayStrip } from "./day-strip"
import { TimeBlockColumn } from "./time-block-column"
import { ActivityCard } from "./activity-card"
import { ActivityDrawer } from "./activity-drawer"
import { createClient } from "@/lib/supabase/client"
import { moveActivity, reorderActivities } from "@/app/actions/move-activity"
import { daysBetween } from "@/lib/dates"
import { detectTimeConflicts } from "@/lib/time-conflicts"
import type { Activity, TimeBlock, Trip } from "@/lib/types"
import { toast } from "sonner"

type BlockKey = `${string}::${TimeBlock}`

const TIME_BLOCKS: TimeBlock[] = ["morning", "afternoon", "night"]

export function ItineraryBoard({
  trip,
  initialActivities,
}: {
  trip: Trip
  initialActivities: Activity[]
}) {
  const days = useMemo(() => daysBetween(trip.start_date, trip.end_date), [trip.start_date, trip.end_date])

  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [selectedDay, setSelectedDay] = useState<string>(days[0])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawerState, setDrawerState] = useState<
    | { mode: "create"; day_date: string; time_block: TimeBlock }
    | { mode: "edit"; activity: Activity }
    | null
  >(null)

  const conflicts = useMemo(() => detectTimeConflicts(activities), [activities])

  const stripRef = useRef<HTMLDivElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Group activities into block buckets keyed by `${day}::${block}` (exclude wishlist items)
  const buckets = useMemo(() => {
    const out = new Map<BlockKey, Activity[]>()
    for (const day of days) {
      for (const block of TIME_BLOCKS) {
        out.set(`${day}::${block}`, [])
      }
    }
    for (const a of activities) {
      if (!a.is_wishlist && a.day_date && a.time_block) {
        const key = `${a.day_date}::${a.time_block}` as BlockKey
        const list = out.get(key)
        if (list) list.push(a)
      }
    }
    for (const list of out.values()) list.sort((a, b) => a.position - b.position)
    return out
  }, [activities, days])

  const dayCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const day of days) c.set(day, 0)
    for (const a of activities) {
      if (a.day_date && !a.is_wishlist) c.set(a.day_date, (c.get(a.day_date) ?? 0) + 1)
    }
    return c
  }, [activities, days])

  // Keyboard navigation for day strip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return
      const idx = days.indexOf(selectedDay)
      if (e.key === "ArrowRight" && idx < days.length - 1) {
        e.preventDefault()
        setSelectedDay(days[idx + 1])
      } else if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault()
        setSelectedDay(days[idx - 1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [days, selectedDay])

  function findActivity(id: string) {
    return activities.find((a) => a.id === id) ?? null
  }

  function findContainer(id: string): BlockKey | null {
    if (!id) return null
    if (id.includes("::")) return id as BlockKey
    if (id.startsWith("day::")) return null
    const a = findActivity(id)
    if (!a) return null
    return `${a.day_date}::${a.time_block}` as BlockKey
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return
    if (overIdStr.startsWith("day::")) return // handled on drop

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return
    if (activeContainer === overContainer) return

    // Move card to a new container during hover
    const [day, block] = overContainer.split("::") as [string, TimeBlock]
    setActivities((prev) =>
      prev.map((a) => (a.id === activeIdStr ? { ...a, day_date: day, time_block: block } : a)),
    )
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const moved = findActivity(activeIdStr)
    if (!moved) return

    // Drop on a day card → drop into morning block of that day
    if (overIdStr.startsWith("day::")) {
      const day = overIdStr.replace("day::", "")
      if (day !== moved.day_date || moved.time_block !== "morning") {
        setSelectedDay(day)
        await applyMove(activeIdStr, day, "morning", 0)
      }
      return
    }

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr)
    if (!activeContainer || !overContainer) return

    const [overDay, overBlock] = overContainer.split("::") as [string, TimeBlock]

    // If dropped on a block container directly (empty zone)
    if (overIdStr === overContainer) {
      await applyMove(activeIdStr, overDay, overBlock, buckets.get(overContainer)?.length ?? 0)
      return
    }

    // Reorder within container, possibly moved across containers in onDragOver
    const list = activities
      .filter((a) => a.day_date === overDay && a.time_block === overBlock)
      .sort((a, b) => a.position - b.position)
    const overIndex = list.findIndex((a) => a.id === overIdStr)
    const activeIndex = list.findIndex((a) => a.id === activeIdStr)

    let newIndex = overIndex
    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      // dnd-kit semantics: reorder
      newIndex = overIndex
    } else if (activeIndex === -1) {
      newIndex = overIndex
    }

    await applyMove(activeIdStr, overDay, overBlock, newIndex)
  }

  async function applyMove(activityId: string, day: string, block: TimeBlock, targetIndex: number) {
    // Reorder optimistically: build new bucket order
    setActivities((prev) => {
      const updated = prev.map((a) => (a.id === activityId ? { ...a, day_date: day, time_block: block } : a))
      const inBucket = updated
        .filter((a) => a.day_date === day && a.time_block === block)
        .sort((a, b) => (a.id === activityId ? -0.5 : a.position) - (b.id === activityId ? -0.5 : b.position))
      // Remove the moving one from its current position
      const without = inBucket.filter((a) => a.id !== activityId)
      const moving = inBucket.find((a) => a.id === activityId)
      if (!moving) return updated
      const clamped = Math.max(0, Math.min(targetIndex, without.length))
      const reordered = [...without.slice(0, clamped), moving, ...without.slice(clamped)]
      const positionMap = new Map(reordered.map((a, idx) => [a.id, idx]))
      return updated.map((a) =>
        a.day_date === day && a.time_block === block ? { ...a, position: positionMap.get(a.id) ?? a.position } : a,
      )
    })

    // Persist using server action
    try {
      // Update the moved activity itself
      await moveActivity(activityId, day, block, targetIndex)

      // Renumber the bucket positions for stability
      setActivities((latest) => {
        const bucket = latest
          .filter((a) => a.day_date === day && a.time_block === block)
          .sort((a, b) => a.position - b.position)
        // Fire-and-forget renumber for the bucket
        reorderActivities(bucket.map((a, idx) => ({ id: a.id, position: idx }))).catch(() => null)
        return latest
      })
    } catch (err) {
      toast.error("Could not save order", { description: err instanceof Error ? err.message : "Unknown" })
    }
  }

  async function handleSave(input: {
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
  }) {
    const supabase = createClient()
    if (input.id) {
      // Edit
      const { error } = await supabase
        .from("activities")
        .update({
          day_date: input.day_date,
          time_block: input.time_block,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          photo_url: input.photo_url,
        })
        .eq("id", input.id)
      if (error) throw error
      setActivities((prev) =>
        prev.map((a) =>
          a.id === input.id
            ? {
                ...a,
                ...input,
              }
            : a,
        ),
      )
      toast.success("Activity updated")
    } else {
      const targetIndex = (buckets.get(`${input.day_date}::${input.time_block}` as BlockKey) ?? []).length
      const { data, error } = await supabase
        .from("activities")
        .insert({
          trip_id: trip.id,
          day_date: input.day_date,
          time_block: input.time_block,
          position: targetIndex,
          title: input.title,
          location: input.location,
          start_time: input.start_time,
          end_time: input.end_time,
          notes: input.notes,
          cost_amount: input.cost_amount,
          cost_currency: "USD",
          photo_url: input.photo_url,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("Insert failed")
      setActivities((prev) => [...prev, data as Activity])
      toast.success("Activity added")
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const prev = activities
    setActivities((p) => p.filter((a) => a.id !== id))
    const { error } = await supabase.from("activities").delete().eq("id", id)
    if (error) {
      setActivities(prev)
      toast.error("Could not delete")
      throw error
    }
    toast.success("Activity removed")
  }

  const dragging = activeId ? findActivity(activeId) : null

  return (
    <div className="flex flex-col gap-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <DayStrip
          ref={stripRef}
          days={days}
          counts={dayCounts}
          selected={selectedDay}
          onSelect={setSelectedDay}
          activeDragId={activeId}
        />

        <div className="grid gap-4">
          {TIME_BLOCKS.map((block) => {
            const key = `${selectedDay}::${block}` as BlockKey
            const items = buckets.get(key) ?? []
            return (
              <TimeBlockColumn
                key={key}
                id={key}
                block={block}
                items={items}
                onAdd={() => setDrawerState({ mode: "create", day_date: selectedDay, time_block: block })}
              >
                <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  {items.map((a) => (
                    <ActivityCard
                      key={a.id}
                      activity={a}
                      onClick={() => setDrawerState({ mode: "edit", activity: a })}
                    />
                  ))}
                </SortableContext>
              </TimeBlockColumn>
            )
          })}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-xl bg-transparent"
            onClick={() => setDrawerState({ mode: "create", day_date: selectedDay, time_block: "morning" })}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add activity
          </Button>
        </div>

        <DragOverlay>{dragging ? <ActivityCard activity={dragging} dragging /> : null}</DragOverlay>
      </DndContext>

      <ActivityDrawer
        state={drawerState}
        days={days}
        onClose={() => setDrawerState(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}
