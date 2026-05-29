"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface PendingEntry<T> {
  item: T
  timeoutId: ReturnType<typeof setTimeout>
  toastId: string | number
  onConfirm: (item: T) => Promise<void>
  onRestore: (item: T) => void
}

function UndoToastContent({
  toastId,
  message,
  onUndo,
  duration,
}: {
  toastId: string | number
  message: string
  onUndo: () => void
  duration: number
}) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-4 py-3 shadow-lg min-w-[280px] max-w-sm">
      <span className="flex-1 text-sm font-medium text-card-foreground">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-[#F2686C] transition-colors hover:bg-[#F2686C]/10"
      >
        Undo
      </button>
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-[#A9D6C5] origin-left"
        style={{
          animationName: "undo-shrink",
          animationDuration: `${duration}ms`,
          animationTimingFunction: "linear",
          animationFillMode: "forwards",
        }}
      />
    </div>
  )
}

export function useUndoDelete<T extends { id: string }>(options?: { delay?: number }) {
  const delay = options?.delay ?? 6500
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const pendingRef = useRef<Map<string, PendingEntry<T>>>(new Map())
  const lastIdRef = useRef<string | null>(null)

  const doUndo = useCallback((id: string) => {
    const entry = pendingRef.current.get(id)
    if (!entry) return
    clearTimeout(entry.timeoutId)
    toast.dismiss(entry.toastId)
    pendingRef.current.delete(id)
    if (lastIdRef.current === id) lastIdRef.current = null
    setPendingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    entry.onRestore(entry.item)
  }, [])

  const softDelete = useCallback(
    (
      item: T,
      callbacks: {
        onConfirm: (item: T) => Promise<void>
        onRestore: (item: T) => void
        label?: string
      },
    ) => {
      const { id } = item
      const { onConfirm, onRestore, label = "Item" } = callbacks

      const existing = pendingRef.current.get(id)
      if (existing) {
        clearTimeout(existing.timeoutId)
        toast.dismiss(existing.toastId)
      }

      setPendingIds((prev) => new Set([...prev, id]))
      lastIdRef.current = id

      const timeoutId = setTimeout(async () => {
        pendingRef.current.delete(id)
        if (lastIdRef.current === id) lastIdRef.current = null
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        try {
          await onConfirm(item)
        } catch {
          toast.error(`Could not delete ${label.toLowerCase()}`)
          onRestore(item)
        }
      }, delay)

      const toastId = toast.custom(
        (t) => (
          <UndoToastContent
            toastId={t}
            message={`${label} deleted`}
            onUndo={() => doUndo(id)}
            duration={delay}
          />
        ),
        { duration: delay },
      )

      pendingRef.current.set(id, { item, timeoutId, toastId, onConfirm, onRestore })
    },
    [delay, doUndo],
  )

  const undoLast = useCallback(() => {
    if (lastIdRef.current) doUndo(lastIdRef.current)
  }, [doUndo])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && pendingRef.current.size > 0) {
        e.preventDefault()
        undoLast()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undoLast])

  return { softDelete, pendingIds }
}
