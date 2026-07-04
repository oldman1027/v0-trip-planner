"use client"

import { useEffect } from "react"

export function PrintTrigger() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("print") === "1") {
      setTimeout(() => window.print(), 800)
    }
  }, [])
  return null
}
