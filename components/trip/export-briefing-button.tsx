"use client"

import { useRouter } from "next/navigation"

interface Props {
  tripId: string
  className?: string
  children?: React.ReactNode
}

export function ExportBriefingButton({ tripId, className, children }: Props) {
  function handleClick() {
    window.open(`/trips/${tripId}/briefing`, "_blank", "noopener")
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children ?? "Export Briefing PDF"}
    </button>
  )
}
