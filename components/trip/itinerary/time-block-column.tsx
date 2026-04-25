"use client"

import type { ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Plus, Sunrise, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Activity, TimeBlock } from "@/lib/types"

const META: Record<TimeBlock, { label: string; icon: typeof Sunrise }> = {
  morning: { label: "Morning", icon: Sunrise },
  afternoon: { label: "Afternoon", icon: Sun },
  night: { label: "Night", icon: Moon },
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
  const Icon = META[block].icon

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
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="font-serif text-lg">{META[block].label}</h3>
          <span className="tabular text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "activity" : "activities"}
          </span>
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
