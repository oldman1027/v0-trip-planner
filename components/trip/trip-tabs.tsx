"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Itinerary", slug: "" },
  { label: "Overview", slug: "overview" },
  { label: "Bookings", slug: "bookings" },
  { label: "Costs", slug: "costs" },
]

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname()
  const base = `/trips/${tripId}`

  return (
    <div className="mt-6 w-full px-6">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border" aria-label="Trip sections">
        {TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base
          const active = t.slug ? pathname === href || pathname.startsWith(href + "/") : pathname === base
          return (
            <Link
              key={t.label}
              href={href}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {active ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden />
              ) : null}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
