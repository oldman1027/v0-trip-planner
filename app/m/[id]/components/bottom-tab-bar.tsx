"use client"

import { CalendarDays, List, Hotel, DollarSign, Map, type LucideIcon } from "lucide-react"

export type MobileTab = "today" | "all" | "bookings" | "costs" | "map"

const TABS: { id: MobileTab; label: string; Icon: LucideIcon }[] = [
  { id: "today",    label: "Today",    Icon: CalendarDays },
  { id: "all",      label: "All Days", Icon: List },
  { id: "bookings", label: "Bookings", Icon: Hotel },
  { id: "costs",    label: "Costs",    Icon: DollarSign },
  { id: "map",      label: "Map",      Icon: Map },
]

const ACTIVE = "#6D8F87"
const INACTIVE = "#B5C4C1"

export function BottomTabBar({
  active,
  onChange,
}: {
  active: MobileTab
  onChange: (tab: MobileTab) => void
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FDFAF6",
        borderTop: "0.5px solid #D4C9BC",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
        zIndex: 50,
      }}
    >
      <div className="mx-auto flex max-w-[430px] items-center">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active
          const color = isActive ? ACTIVE : INACTIVE
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(id)}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors active:bg-black/[0.04]"
              style={{ minHeight: 60 }}
            >
              <span style={{ color, display: "flex" }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-medium" style={{ color }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
