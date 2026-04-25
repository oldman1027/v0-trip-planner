"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Plus, X } from "lucide-react"

type DayActionsPanelProps = {
  dayDate: string
  dayLabel: string
  onAddActivity: () => void
  onClose: () => void
  timeConflictCount?: number
}

export function DayActionsPanel({
  dayDate,
  dayLabel,
  onAddActivity,
  onClose,
  timeConflictCount = 0,
}: DayActionsPanelProps) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveNotes = async () => {
    if (!notes.trim()) return
    setIsSaving(true)
    // TODO: Save to day_notes table
    setIsSaving(false)
  }

  return (
    <Card className="border-l-4 border-l-accent p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg">{dayLabel}</h3>
            <p className="text-xs text-muted-foreground tabular">{dayDate}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {timeConflictCount > 0 ? (
          <div className="flex gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100">
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
            <span>
              {timeConflictCount} time {timeConflictCount === 1 ? "conflict" : "conflicts"} on this day
            </span>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Day notes</label>
          <Textarea
            placeholder="Add notes for this day..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
            rows={3}
          />
          {notes.trim() ? (
            <Button size="sm" onClick={handleSaveNotes} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save notes"}
            </Button>
          ) : null}
        </div>

        <Button onClick={onAddActivity} className="w-full" variant="secondary">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add activity
        </Button>
      </div>
    </Card>
  )
}
