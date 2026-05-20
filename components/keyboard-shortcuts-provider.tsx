"use client"

import { useState } from "react"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal"

export function KeyboardShortcutsProvider() {
  const [open, setOpen] = useState(false)

  // "?" key: e.key is "?" which requires Shift on US keyboards
  useKeyboardShortcuts([
    { key: "?", shift: true, handler: () => setOpen(true) },
  ])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/70 font-mono text-xs font-semibold text-muted-foreground/60 shadow-sm backdrop-blur-sm transition-all hover:border-border hover:bg-card hover:text-foreground"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
      <KeyboardShortcutsModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
