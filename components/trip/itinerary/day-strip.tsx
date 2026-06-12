"use client"

import { forwardRef } from "react"
import { useDroppable } from "@dnd-kit/core"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { parseDateOnly } from "@/lib/dates"
import type { Activity } from "@/lib/types"

type Props = {
  days: string[]
  selected: string
  onSelect: (day: string) => void
  activeDragId: string | null
  activities: Activity[]
  tripCoverUrl: string | null
}

function getPhotoForDay(day: string, activities: Activity[], fallback: string | null): string | null {
  return activities.find((a) => a.day_date === day && a.photo_url?.startsWith("https://"))?.photo_url ?? fallback
}

function getCityForDay(day: string, activities: Activity[]): string | null {
  const first = activities
    .filter((a) => a.day_date === day && a.location && !a.is_wishlist && !a.is_kiv)
    .sort((a, b) => (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99"))[0]
  return first?.location?.split(",")[0]?.trim() ?? null
}

export const DayStrip = forwardRef<HTMLDivElement, Props>(function DayStrip(
  { days, selected, onSelect, activeDragId, activities, tripCoverUrl },
  ref,
) {
  return (
    <div ref={ref}>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {days.map((day, idx) => (
            <DayCard
              key={day}
              day={day}
              dayIndex={idx + 1}
              selected={selected === day}
              onSelect={() => onSelect(day)}
              isDragging={activeDragId !== null}
              photo={getPhotoForDay(day, activities, tripCoverUrl)}
              city={getCityForDay(day, activities)}
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
  selected,
  onSelect,
  isDragging,
  photo,
  city,
}: {
  day: string
  dayIndex: number
  selected: boolean
  onSelect: () => void
  isDragging: boolean
  photo: string | null
  city: string | null
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
        "relative flex min-w-[110px] h-[84px] shrink-0 flex-col justify-end overflow-hidden rounded-xl transition-all text-left",
        selected ? "ring-2 ring-white shadow-lg" : "opacity-75 hover:opacity-100",
        isDragging && isOver && "ring-2 ring-[#A9D6C5] ring-offset-1",
      )}
    >
      {/* Background photo */}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[#A9D6C5]" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 px-2.5 pb-2">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
          Day {dayIndex}
        </div>
        {city ? (
          <div className="text-[11px] font-bold text-white leading-tight truncate mt-0.5">
            {city}
          </div>
        ) : null}
        <div className="text-[9px] text-white/50 tabular">
          {format(date, "EEE, d MMM")}
        </div>
      </div>
    </button>
  )
}
