"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface MemberFilterContextValue {
  filterCreatorId: string | null
  setFilterCreatorId: (id: string | null) => void
}

const MemberFilterContext = createContext<MemberFilterContextValue>({
  filterCreatorId: null,
  setFilterCreatorId: () => {},
})

export function MemberFilterProvider({ children }: { children: ReactNode }) {
  const [filterCreatorId, setFilterCreatorId] = useState<string | null>(null)
  return (
    <MemberFilterContext.Provider value={{ filterCreatorId, setFilterCreatorId }}>
      {children}
    </MemberFilterContext.Provider>
  )
}

export function useMemberFilter() {
  return useContext(MemberFilterContext)
}
