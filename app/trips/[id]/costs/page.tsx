import { PiggyBank } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export default function CostsPage() {
  return (
    <Empty className="rounded-2xl border border-dashed border-border bg-card/50 py-24">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-secondary text-primary">
          <PiggyBank className="h-6 w-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-2xl">Cost tracking coming soon</EmptyTitle>
        <EmptyDescription className="max-w-md text-pretty">
          Split bills, track who paid for what, and settle up at the end of the trip — without spreadsheets.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
