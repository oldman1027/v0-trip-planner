"use client"

import { useDroppable } from "@dnd-kit/core"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"

type WeatherDay = { icon: string; high: number }

type Props = {
  days: string[]
  counts: Map<string, number>
  selected: string
  onSelect: (day: string) => void
  activeDragId: string | null
  weatherByDay?: Map<string, WeatherDay>
}

export function DaySidebar({ days, counts, selected, onSelect, activeDragId, weatherByDay }: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 pr-1">
        {days.map((day, idx) => (
          <DayItem
            key={day}
            day={day}
            dayIndex={idx + 1}
            count={counts.get(day) ?? 0}
            selected={selected === day}
            onSelect={() => onSelect(day)}
            isDragging={activeDragId !== null}
            weather={weatherByDay?.get(day)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function DayItem({
  day,
  dayIndex,
  count,
  selected,
  onSelect,
  isDragging,
  weather,
}: {
  day: string
  dayIndex: number
  count: number
  selected: boolean
  onSelect: () => void
  isDragging: boolean
  weather?: WeatherDay
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
        "flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-left transition-all",
        selected
          ? "border-primary bg-secondary/60 shadow-sm"
          : "border-border hover:border-foreground/20",
        isDragging && isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          Day {dayIndex}
        </span>
        <div className="font-serif text-base">{format(date, "EEE")}</div>
        <div className="text-sm text-muted-foreground">{format(date, "MMM d")}</div>
        {weather && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{weather.icon}</span>
            <span>{weather.high}°</span>
          </div>
        )}
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
          count > 0 ? "bg-secondary text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  )
}
