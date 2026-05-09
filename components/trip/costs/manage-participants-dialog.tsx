"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, AlertTriangle, Check, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  createExpenseParticipant,
  updateExpenseParticipant,
  deleteExpenseParticipant,
  participantHasSplits,
} from "@/lib/supabase/expense-participants"
import type { ExpenseParticipant } from "@/lib/types"

export function ManageParticipantsDialog({
  tripId,
  open,
  participants,
  onOpenChange,
  onParticipantsChange,
}: {
  tripId: string
  open: boolean
  participants: ExpenseParticipant[]
  onOpenChange: (open: boolean) => void
  onParticipantsChange: (participants: ExpenseParticipant[]) => void
}) {
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [pendingDelete, setPendingDelete] = useState<ExpenseParticipant | null>(null)
  const [deleteHasSplits, setDeleteHasSplits] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await createExpenseParticipant(tripId, newName.trim())
      onParticipantsChange([...participants, created])
      setNewName("")
    } catch {
      toast.error("Could not add member")
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string) {
    if (!editingName.trim()) return
    setSaving(true)
    try {
      const updated = await updateExpenseParticipant(id, editingName.trim())
      onParticipantsChange(participants.map((p) => (p.id === id ? updated : p)))
      setEditingId(null)
      setEditingName("")
    } catch {
      toast.error("Could not update member")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteClick(p: ExpenseParticipant) {
    const hasSplits = await participantHasSplits(p.id)
    setDeleteHasSplits(hasSplits)
    setPendingDelete(p)
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setSaving(true)
    try {
      await deleteExpenseParticipant(pendingDelete.id)
      onParticipantsChange(participants.filter((p) => p.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch {
      toast.error("Could not remove member")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Trip Members</DialogTitle>
            <DialogDescription>Add people to split expenses with</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Name (e.g. Alice)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="rounded-xl"
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="shrink-0 rounded-xl"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {participants.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No members yet — add some to start splitting!
              </p>
            ) : (
              participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2"
                >
                  {editingId === p.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleEdit(p.id)}
                        className="h-8 flex-1 rounded-lg text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleEdit(p.id)}
                        disabled={saving}
                        className="rounded-lg p-1 text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditingName("") }}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => { setEditingId(p.id); setEditingName(p.name) }}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(p)}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteHasSplits && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              Remove {pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteHasSplits
                ? "This member has existing expense splits. Removing them will also delete those split records. This cannot be undone."
                : "This will remove them from the trip member list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
