import Link from "next/link"
import { MapPin } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import type { ReactNode } from "react"

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/trips" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-serif text-lg tracking-tight">Trip Planner</span>
        </Link>
        <div className="flex items-center gap-3">
          {children}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
