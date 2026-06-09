"use client"

import type { ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Activity, TimeBlock } from "@/lib/types"

const META: Record<TimeBlock, { label: string; emoji: string; badgeCls: string }> = {
  morning:   { label: "Morning",   emoji: "🌅", badgeCls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" },
  afternoon: { label: "Afternoon", emoji: "☀️", badgeCls: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30" },
  night:     { label: "Night",     emoji: "🌙", badgeCls: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30" },
}

export function TimeBlockColumn({
  id,
  block,
  items,
  onAdd,
  children,
}: {
  id: string
  block: TimeBlock
  items: Activity[]
  onAdd: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      aria-label={META[block].label}
      className={cn(
        "rounded-2xl border bg-card transition-colors",
        isOver ? "border-primary bg-secondary/40" : "border-border",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-[18px]", META[block].badgeCls)}>
            {META[block].emoji}
          </span>
          <div>
            <h3 className="font-serif text-base leading-tight">{META[block].label}</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {items.length} {items.length === 1 ? "activity" : "activities"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </header>

      <div className="flex flex-col gap-2.5 p-3">
        {items.length === 0 ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background/30 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <span>Drag an activity here or add one</span>
          </button>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
