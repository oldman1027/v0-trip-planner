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
        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-[#6D8F87] bg-[#6D8F87] shadow-sm"
          : "border-border bg-card hover:border-foreground/20",
        isDragging && isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            selected ? "text-white/80" : "text-muted-foreground",
          )}
        >
          Day {dayIndex}
        </span>
        <div className={cn("font-serif text-base", selected ? "text-white" : "")}>{format(date, "EEE")}</div>
        <div className={cn("text-sm", selected ? "text-white/70" : "text-muted-foreground")}>{format(date, "MMM d")}</div>
        {weather && (
          <div className={cn("mt-1 flex items-center gap-1 text-xs", selected ? "text-white/60" : "text-muted-foreground")}>
            <span>{weather.icon}</span>
            <span>{weather.high}°</span>
          </div>
        )}
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
          selected
            ? "bg-white text-[#6D8F87]"
            : count > 0
              ? "bg-secondary text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  )
}
