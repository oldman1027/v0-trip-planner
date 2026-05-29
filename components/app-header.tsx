import Link from "next/link"
import Image from "next/image"
import { UserMenu } from "@/components/user-menu"
import type { ReactNode } from "react"

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/trips" className="flex items-center gap-2">
          <Image src="/favicon.png" alt="Tripletto" width={32} height={32} className="rounded-lg" />
          <span className="font-serif text-lg tracking-tight">Tripletto</span>
        </Link>
        <div className="flex items-center gap-3">
          {children}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
