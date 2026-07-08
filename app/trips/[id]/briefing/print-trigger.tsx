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

export function PrintButton({ style }: { style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={style}
    >
      Save as PDF / Print
    </button>
  )
}
