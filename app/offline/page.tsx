import Link from "next/link"
import { WifiOff, MapPin } from "lucide-react"

export default function OfflinePage() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "#FFFBF4" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "#EDF5F2" }}
      >
        <WifiOff className="h-8 w-8" style={{ color: "#6D8F87" }} />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "#2C4A45" }}>
          You&apos;re offline
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#6D8F87" }}>
          Your last-viewed trip data is still available.
          <br />
          Connect to the internet to see the latest updates.
        </p>
      </div>

      <Link
        href="/"
        className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
        style={{ background: "#6D8F87" }}
      >
        <MapPin className="h-4 w-4" />
        Go to my trips
      </Link>
    </div>
  )
}
