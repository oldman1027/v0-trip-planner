"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ShortcutItem = { keys: string[]; description: string }
type ShortcutSection = { title: string; items: ShortcutItem[] }

const SECTIONS: ShortcutSection[] = [
  {
    title: "Global",
    items: [
      { keys: ["Cmd", "Z"], description: "Undo last deletion" },
      { keys: ["Esc"], description: "Close any modal or drawer" },
      { keys: ["?"], description: "Show this shortcuts panel" },
    ],
  },
  {
    title: "Itinerary",
    items: [
      { keys: ["N"], description: "Add new activity" },
      { keys: ["1"], description: "Switch to Board view" },
      { keys: ["2"], description: "Switch to Calendar view" },
      { keys: ["M"], description: "Toggle map panel (Calendar view)" },
      { keys: ["←", "→"], description: "Navigate previous / next day" },
      { keys: ["Del"], description: "Delete selected activity" },
    ],
  },
  {
    title: "Bookings",
    items: [
      { keys: ["N"], description: "Add new booking" },
      { keys: ["1"], description: "Switch to List view" },
      { keys: ["2"], description: "Switch to Card view" },
      { keys: ["Del"], description: "Delete selected booking" },
    ],
  },
  {
    title: "Costs",
    items: [
      { keys: ["N"], description: "Add new expense" },
    ],
  },
  {
    title: "Forms",
    items: [
      { keys: ["Esc"], description: "Close without saving" },
      { keys: ["Cmd", "↵"], description: "Save / submit form" },
    ],
  },
]

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-foreground shadow-[0_1px_0_0] shadow-border">
      {label}
    </kbd>
  )
}

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-serif text-xl">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          {SECTIONS.map((section) => (
            <div key={section.title} className="px-6 py-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.description} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{item.description}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-0.5">
                          {i > 0 && (
                            <span className="mx-0.5 text-[10px] text-muted-foreground">+</span>
                          )}
                          <KeyBadge label={k} />
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-6 py-3 text-center text-[11px] text-muted-foreground">
          Shortcuts are disabled when typing in a form field
        </div>
      </DialogContent>
    </Dialog>
  )
}
