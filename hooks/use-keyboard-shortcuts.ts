"use client"

import { useEffect, useRef } from "react"

export type KeyBinding = {
  /** Exact KeyboardEvent.key value, e.g. "n", "Delete", "Enter", "?" */
  key: string
  /** Require Cmd (Mac) or Ctrl (Windows) to be held. Default: false */
  meta?: boolean
  /** Require Shift to be held. Default: false */
  shift?: boolean
  /** Require Alt/Option to be held. Default: false */
  alt?: boolean
  /** Fire even when an input, textarea, or select has focus. Default: false */
  allowInInput?: boolean
  handler: () => void
}

/**
 * Registers global keydown shortcuts.
 * Uses a ref for the bindings array so callers don't need to memoize it.
 * All listeners are cleaned up automatically on unmount or when `enabled` toggles off.
 */
export function useKeyboardShortcuts(bindings: KeyBinding[], enabled = true) {
  const ref = useRef(bindings)
  ref.current = bindings

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable

      for (const b of ref.current) {
        if (inInput && !b.allowInInput) continue

        const metaMatch = b.meta ? (e.metaKey || e.ctrlKey) : !e.metaKey && !e.ctrlKey
        const shiftMatch = b.shift ? e.shiftKey : !e.shiftKey
        const altMatch = b.alt ? e.altKey : !e.altKey

        if (e.key === b.key && metaMatch && shiftMatch && altMatch) {
          e.preventDefault()
          b.handler()
          return
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}
