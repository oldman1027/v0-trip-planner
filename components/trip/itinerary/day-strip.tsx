"use client"

import { forwardRef } from "react"
import { useDroppable } from "@dnd-kit/core"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"

type Props = {
  days: string[]
  counts: Map<string, number>
  selected: string
  onSelect: (day: string) => void
  activeDragId: string | null
}

export const DayStrip = forwardRef<HTMLDivElement, Props>(function DayStrip(
  { days, counts, selected, onSelect, activeDragId },
  ref,
) {
  return (
    <div ref={ref}>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-3">
          {days.map((day, idx) => (
            <DayCard
              key={day}
              day={day}
              dayIndex={idx + 1}
              count={counts.get(day) ?? 0}
              selected={selected === day}
              onSelect={() => onSelect(day)}
              isDragging={activeDragId !== null}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
})

function DayCard({
  day,
  dayIndex,
  count,
  selected,
  onSelect,
  isDragging,
}: {
  day: string
  dayIndex: number
  count: number
  selected: boolean
  onSelect: () => void
  isDragging: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day::${day}` })
  const date = parseDateOnly(day)

  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex min-w-[140px] shrink-0 flex-col gap-1 rounded-2xl border bg-card px-4 py-3 text-left transition-all",
        selected ? "border-primary bg-secondary/60 shadow-sm" : "border-border hover:border-foreground/20",
        isDragging && isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium uppercase tracking-wide", selected ? "text-primary" : "text-muted-foreground")}>
          Day {dayIndex}
        </span>
        <span
          className={cn(
            "tabular rounded-full px-2 py-0.5 text-[10px] font-medium",
            count > 0 ? "bg-secondary text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      </div>
      <div className="font-serif text-base">{format(date, "EEE")}</div>
      <div className="tabular text-sm text-muted-foreground">{format(date, "MMM d")}</div>
    </button>
  )
}
