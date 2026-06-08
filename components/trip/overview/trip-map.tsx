"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { Activity } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────

type Pinned = { activity: Activity; lat: number; lng: number; color: PinColor }
type PinColor = { bg: string; border: string }
type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement
  el: HTMLElement      // wrapper element (transform target)
  pinEl: HTMLElement   // inner circle (box-shadow target)
  dayDate: string | null
}

// ── Brand colour palette — one hue per trip day, cycling ──────────────────

export const PIN_PALETTE: PinColor[] = [
  { bg: "#A9D6C5", border: "#6D8F87" },
  { bg: "#F7A59E", border: "#de4a66" },
  { bg: "#f9d157", border: "#fd7a56" },
  { bg: "#6D8F87", border: "#5A7870" },
  { bg: "#fd7a56", border: "#C44A20" },
  { bg: "#8EC4B2", border: "#6D8F87" },
  { bg: "#fca9a9", border: "#F2686C" },
  { bg: "#C8E8DF", border: "#6D8F87" },
  { bg: "#F2686C", border: "#de4a66" },
  { bg: "#5A7870", border: "#2C4A45" },
  { bg: "#de4a66", border: "#9B2335" },
  { bg: "#f9d157", border: "#C89A00" },
  { bg: "#8EC4B2", border: "#6D8F87" },
  { bg: "#fd7a56", border: "#de4a66" },
  { bg: "#C8E8DF", border: "#A9D6C5" },
]

function pinColor(dayIndex: number): PinColor {
  return PIN_PALETTE[Math.max(dayIndex, 0) % PIN_PALETTE.length]
}

function makePinElement(
  label: string,
  color: PinColor,
  locationName: string,
  dayLabel: string,
): { el: HTMLElement; pinEl: HTMLElement } {
  // Wrapper holds day chip + circle + location label
  const el = document.createElement("div")
  el.style.cssText = [
    "display:flex", "flex-direction:column", "align-items:center",
    "cursor:pointer", "user-select:none",
    "transition:transform 0.15s ease",
  ].join(";")

  // Day chip above the circle
  const dayChip = document.createElement("div")
  dayChip.style.cssText = [
    `background:${color.bg}`,
    `border:1.5px solid ${color.border}`,
    "color:white",
    "font-size:9px", "font-weight:800",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "padding:1px 7px", "border-radius:99px",
    "margin-bottom:3px",
    "white-space:nowrap",
    "text-shadow:0 1px 2px rgba(0,0,0,0.35)",
    "box-shadow:0 1px 3px rgba(0,0,0,0.2)",
    "line-height:1.5",
  ].join(";")
  dayChip.textContent = dayLabel

  // Main numbered circle
  const pinEl = document.createElement("div")
  pinEl.style.cssText = [
    "width:34px", "height:34px", "border-radius:50%",
    `background:${color.bg}`, `border:2.5px solid ${color.border}`,
    "display:flex", "align-items:center", "justify-content:center",
    "color:white", "font-weight:700", "font-size:13px",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "box-shadow:0 2px 6px rgba(0,0,0,0.3)",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)",
  ].join(";")
  pinEl.textContent = label

  // Location label below the circle
  const short = locationName.length > 20 ? locationName.slice(0, 18) + "…" : locationName
  const locLabel = document.createElement("div")
  locLabel.style.cssText = [
    "margin-top:4px",
    "background:rgba(255,255,255,0.95)",
    "border:1px solid rgba(0,0,0,0.08)",
    "color:#111827",
    "font-size:10px", "font-weight:600",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "padding:2px 7px", "border-radius:6px",
    "white-space:nowrap", "max-width:140px",
    "overflow:hidden", "text-overflow:ellipsis",
    "box-shadow:0 1px 4px rgba(0,0,0,0.12)",
    "text-align:center", "pointer-events:none",
  ].join(";")
  locLabel.textContent = short

  el.appendChild(dayChip)
  el.appendChild(pinEl)
  el.appendChild(locLabel)

  return { el, pinEl }
}

// ── Component ──────────────────────────────────────────────────────────────

export function TripMap({
  activities,
  destination,
  days,
  selectedActivityId,
  className,
  containerClassName,
  onPinClick,
  filterDay: filterDayProp,
  onFilterDayChange,
}: {
  activities: Activity[]
  destination: string | null
  days: string[]
  selectedActivityId?: string | null
  className?: string
  containerClassName?: string
  onPinClick?: (activity: Activity) => void
  /** Controlled day filter — when provided the internal filter buttons are hidden */
  filterDay?: string | null
  onFilterDayChange?: (day: string | null) => void
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<google.maps.Map | null>(null)
  const geocodedRef   = useRef<Pinned[]>([])
  // activity.id → marker entry; never cleared between renders so day-filter
  // and selection can work without re-geocoding.
  const markersRef    = useRef<Map<string, MarkerEntry>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  // Stable mirrors of state — safe to read inside async callbacks.
  const filterDayRef    = useRef<string | null>(null)
  const selectedIdRef   = useRef<string | null>(null)

  // ── State ───────────────────────────────────────────────────────────────
  const [loading,          setLoading]          = useState(true)
  const [pinCount,         setPinCount]         = useState(0)
  const [activeDays,       setActiveDays]       = useState<string[]>([])
  const [internalFilterDay, setInternalFilterDay] = useState<string | null>(null)
  const [selectedId,       setSelectedId]       = useState<string | null>(null)

  // Controlled vs. uncontrolled — when parent provides filterDay, use it.
  const isControlled = filterDayProp !== undefined
  const filterDay = isControlled ? (filterDayProp ?? null) : internalFilterDay

  function setFilterDay(day: string | null) {
    if (isControlled) onFilterDayChange?.(day)
    else setInternalFilterDay(day)
  }

  // Keep refs in sync on every render so async callbacks always see fresh values.
  filterDayRef.current  = filterDay
  selectedIdRef.current = selectedId

  // ── applyVisibility ─────────────────────────────────────────────────────
  // Hides/shows markers by day and applies the selection highlight.
  // Reads only from stable refs — safe to call from anywhere.
  function applyVisibility() {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((entry, id) => {
      const visible = !filterDayRef.current || entry.dayDate === filterDayRef.current
      entry.marker.map = visible ? map : null
      if (!visible) return

      const sel = id === selectedIdRef.current
      entry.el.style.transform = sel ? "scale(1.2)" : ""
      entry.pinEl.style.boxShadow = sel
        ? "0 0 0 3px white, 0 4px 14px rgba(0,0,0,0.45)"
        : "0 2px 6px rgba(0,0,0,0.3)"
      entry.marker.zIndex = sel ? 100 : 0
    })
  }

  // Re-apply whenever filter or selection changes.
  useEffect(() => { applyVisibility() }, [filterDay, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-zoom map to fit pins for the selected day (or all pins when cleared).
  useEffect(() => {
    if (loading || geocodedRef.current.length === 0) return
    const map = mapRef.current
    if (!map) return

    const pinsToFit = filterDay
      ? geocodedRef.current.filter((p) => p.activity.day_date === filterDay)
      : geocodedRef.current

    if (pinsToFit.length === 0) return

    if (pinsToFit.length === 1) {
      map.panTo({ lat: pinsToFit[0].lat, lng: pinsToFit[0].lng })
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14)
      return
    }

    const bounds = new google.maps.LatLngBounds()
    pinsToFit.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    map.fitBounds(bounds, 60)
    google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 20) > 15) map.setZoom(15)
    })
  }, [filterDay, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external selectedActivityId prop → internal state + pan to marker.
  useEffect(() => {
    if (selectedActivityId === undefined) return
    setSelectedId(selectedActivityId)
    if (selectedActivityId) {
      const entry = markersRef.current.get(selectedActivityId)
      if (entry?.marker.position) {
        mapRef.current?.panTo(entry.marker.position as google.maps.LatLngLiteral)
      }
    }
  }, [selectedActivityId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build: geocoding + initial pin placement ────────────────────────────
  useEffect(() => {
    const mappable = activities
      .filter((a) => a.location && !a.is_wishlist)
      .sort((a, b) => {
        const dayA = a.day_date ?? "", dayB = b.day_date ?? ""
        if (dayA !== dayB) return dayA < dayB ? -1 : 1
        const tA = a.start_time ?? "99:99", tB = b.start_time ?? "99:99"
        return tA < tB ? -1 : tA > tB ? 1 : 0
      })
    let cancelled = false

    async function build() {
      let attempts = 0
      while (!window.google?.maps && attempts < 25) {
        await new Promise((r) => setTimeout(r, 200))
        attempts++
      }
      if (!window.google?.maps || !containerRef.current || cancelled) {
        setLoading(false)
        return
      }

      try {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          google.maps.importLibrary("maps")   as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        ])

        const geocoder = new google.maps.Geocoder()
        const settled  = await Promise.allSettled(
          mappable.map(async (a): Promise<Pinned> => {
            const res    = await geocoder.geocode({ address: a.location! })
            const result = res.results[0]
            if (!result) throw new Error("no result")
            const dayIndex = days.indexOf(a.day_date ?? "")
            return {
              activity: a,
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
              color: pinColor(dayIndex),
            }
          }),
        )

        const pins: Pinned[] = settled
          .filter((r): r is PromiseFulfilledResult<Pinned> => r.status === "fulfilled")
          .map((r) => r.value)

        if (!containerRef.current || cancelled) return

        geocodedRef.current = pins

        // Days that actually have at least one geocoded pin
        const daysWithPins = [
          ...new Set(pins.map((p) => p.activity.day_date).filter((d): d is string => !!d)),
        ].sort()

        // Default map centre
        let center: google.maps.LatLngLiteral = { lat: 35.6762, lng: 139.6503 }
        if (pins.length > 0) {
          center = { lat: pins[0].lat, lng: pins[0].lng }
        } else if (destination) {
          const res = await geocoder.geocode({ address: destination })
          const r   = res.results[0]
          if (r) center = { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }
        }

        if (!containerRef.current || cancelled) return

        // Tear down any previous map instance
        markersRef.current.forEach(({ marker }) => { marker.map = null })
        markersRef.current.clear()
        setSelectedId(null)
        setFilterDay(null)

        const map = new Map(containerRef.current, {
          center, zoom: 13, mapId: "DEMO_MAP_ID", clickableIcons: false,
        })
        mapRef.current = map

        if (pins.length > 1) {
          const bounds = new google.maps.LatLngBounds()
          pins.forEach(({ lat, lng }) => bounds.extend({ lat, lng }))
          map.fitBounds(bounds, 60)
        }

        const infoWindow = new google.maps.InfoWindow()
        infoWindowRef.current = infoWindow

        // Close info window + deselect on background click
        map.addListener("click", () => {
          infoWindow.close()
          setSelectedId(null)
        })

        pins.forEach(({ activity: a, lat, lng, color }, index) => {
          const dayIndex = days.indexOf(a.day_date ?? "")
          const dayLabel = dayIndex >= 0 ? `Day ${dayIndex + 1}` : "Day —"
          const { el, pinEl } = makePinElement(String(index + 1), color, a.location ?? a.title, dayLabel)
          const marker = new AdvancedMarkerElement({ map, position: { lat, lng }, title: a.title, content: el })

          markersRef.current.set(a.id, { marker, el, pinEl, dayDate: a.day_date })

          marker.addEventListener("click", () => {
            setSelectedId(a.id)
            onPinClick?.(a)
            infoWindow.setContent(
              `<div style="padding:4px 2px 2px;min-width:140px;max-width:220px">` +
              `<div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:4px">` +
              `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${color.bg};border:1.5px solid ${color.border};color:white;font-size:11px;font-weight:700;flex-shrink:0;text-shadow:0 1px 1px rgba(0,0,0,0.4)">${index + 1}</span>` +
              `<p style="margin:0;font-weight:600;font-size:14px;line-height:1.4">${escHtml(a.title)}</p>` +
              `</div>` +
              `<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4">${escHtml(a.location ?? "")}</p>` +
              `</div>`,
            )
            infoWindow.open({ anchor: marker, map })
          })
        })

        if (!cancelled) {
          setPinCount(pins.length)
          setActiveDays(daysWithPins)
          applyVisibility()
        }
      } catch {
        // map unavailable — fail silently
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    build()
    return () => { cancelled = true }
  }, [activities, destination, days]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={className ?? "relative mt-4 overflow-hidden rounded-2xl border border-border"}>
      {/* Map container must stay in DOM so Google Maps can size itself */}
      <div ref={containerRef} className={containerClassName ?? "aspect-[16/7] w-full bg-muted/40"} />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      )}

      {!loading && pinCount === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-serif text-lg">No pinnable locations yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a location to your activities and they&apos;ll appear here.
          </p>
        </div>
      )}

      {/* Day filter — top-right (hidden in controlled mode; parent provides its own) */}
      {!loading && !isControlled && activeDays.length > 1 && (
        <div className="absolute right-3 top-3 flex gap-1">
          {filterDay && (
            <button
              type="button"
              onClick={() => setFilterDay(null)}
              className="rounded-full bg-card/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card"
            >
              All
            </button>
          )}
          {activeDays.map((day) => {
            const dayNum = days.indexOf(day) + 1
            const active = filterDay === day
            return (
              <button
                key={day}
                type="button"
                onClick={() => setFilterDay(filterDay === day ? null : day)}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-card/90 text-muted-foreground hover:bg-card",
                )}
              >
                D{dayNum}
              </button>
            )
          })}
        </div>
      )}

      {/* Stats — bottom-right */}
      {!loading && pinCount > 0 && (
        <div className="absolute bottom-3 right-3">
          <div className="rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            {`${pinCount} ${pinCount === 1 ? "location" : "locations"}`}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

