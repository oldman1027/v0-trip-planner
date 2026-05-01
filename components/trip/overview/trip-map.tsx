"use client"

import { useEffect, useRef, useState } from "react"
import { Car, Footprints, MapPin } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { Activity } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────

type Pinned = { activity: Activity; lat: number; lng: number; color: PinColor }
type RouteMode = "DRIVING" | "WALKING" | null
type PinColor = { bg: string; border: string }
type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement
  el: HTMLElement
  dayDate: string | null
}

// ── Colour palette — one hue per trip day, cycling ─────────────────────────

const PIN_PALETTE: PinColor[] = [
  { bg: "#F28B82", border: "#C5221F" },
  { bg: "#FBBC04", border: "#E37400" },
  { bg: "#FDD663", border: "#BF8700" },
  { bg: "#81C995", border: "#137333" },
  { bg: "#78C4F9", border: "#1967D2" },
  { bg: "#AF8FEF", border: "#681DA8" },
  { bg: "#FF8BCB", border: "#B80672" },
  { bg: "#A8B4BE", border: "#4A5568" },
  { bg: "#E06060", border: "#9B1C1C" },
  { bg: "#F09030", border: "#92400E" },
  { bg: "#D4A844", border: "#7B6114" },
  { bg: "#52A870", border: "#1A5C38" },
  { bg: "#4A85C8", border: "#1C3F78" },
  { bg: "#8060C0", border: "#3C1878" },
  { bg: "#C05080", border: "#701038" },
]

function pinColor(dayIndex: number): PinColor {
  return PIN_PALETTE[Math.max(dayIndex, 0) % PIN_PALETTE.length]
}

function makePinElement(label: string, color: PinColor): HTMLElement {
  const el = document.createElement("div")
  el.style.cssText = [
    "width:34px", "height:34px", "border-radius:50%",
    `background:${color.bg}`, `border:2.5px solid ${color.border}`,
    "display:flex", "align-items:center", "justify-content:center",
    "color:white", "font-weight:700", "font-size:13px",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "box-shadow:0 2px 6px rgba(0,0,0,0.3)",
    "cursor:pointer", "user-select:none",
    "text-shadow:0 1px 2px rgba(0,0,0,0.4)",
    "transition:transform 0.15s ease, box-shadow 0.15s ease",
  ].join(";")
  el.textContent = label
  return el
}

// ── Component ──────────────────────────────────────────────────────────────

export function TripMap({
  activities,
  destination,
  days,
  selectedActivityId,
  className,
  containerClassName,
}: {
  activities: Activity[]
  destination: string | null
  days: string[]
  selectedActivityId?: string | null
  className?: string
  containerClassName?: string
}) {
  // ── Refs ────────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<google.maps.Map | null>(null)
  const geocodedRef   = useRef<Pinned[]>([])
  // activity.id → marker entry; never cleared between renders so day-filter
  // and selection can work without re-geocoding.
  const markersRef    = useRef<Map<string, MarkerEntry>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const renderersRef  = useRef<google.maps.DirectionsRenderer[]>([])
  const routeLabelsRef= useRef<google.maps.marker.AdvancedMarkerElement[]>([])

  // Stable mirrors of state — safe to read inside async callbacks.
  const filterDayRef    = useRef<string | null>(null)
  const selectedIdRef   = useRef<string | null>(null)

  // ── State ───────────────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true)
  const [pinCount,    setPinCount]    = useState(0)
  const [activeDays,  setActiveDays]  = useState<string[]>([])
  const [routeMode,   setRouteMode]   = useState<RouteMode>(null)
  const [filterDay,   setFilterDay]   = useState<string | null>(null)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [routeStats,  setRouteStats]  = useState<{ distM: number; durS: number } | null>(null)

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
      entry.el.style.transform   = sel ? "scale(1.3)" : ""
      entry.el.style.boxShadow   = sel
        ? "0 0 0 3px white, 0 4px 14px rgba(0,0,0,0.45)"
        : "0 2px 6px rgba(0,0,0,0.3)"
      entry.marker.zIndex = sel ? 100 : 0
    })
  }

  // Re-apply whenever filter or selection changes.
  useEffect(() => { applyVisibility() }, [filterDay, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        renderersRef.current.forEach((r) => r.setMap(null))
        renderersRef.current = []
        routeLabelsRef.current.forEach((m) => { m.map = null })
        routeLabelsRef.current = []
        setRouteMode(null)
        setRouteStats(null)
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
          const el     = makePinElement(String(index + 1), color)
          const marker = new AdvancedMarkerElement({ map, position: { lat, lng }, title: a.title, content: el })

          markersRef.current.set(a.id, { marker, el, dayDate: a.day_date })

          marker.addEventListener("click", () => {
            setSelectedId(a.id)
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

  // ── Route drawing ───────────────────────────────────────────────────────
  useEffect(() => {
    const map  = mapRef.current
    const pins = filterDayRef.current
      ? geocodedRef.current.filter((p) => p.activity.day_date === filterDayRef.current)
      : geocodedRef.current

    renderersRef.current.forEach((r) => r.setMap(null))
    renderersRef.current = []
    routeLabelsRef.current.forEach((m) => { m.map = null })
    routeLabelsRef.current = []
    setRouteStats(null)

    if (!map || !routeMode || pins.length < 2) return

    let cancelled = false

    async function drawSegments() {
      const [{ AdvancedMarkerElement }, { DirectionsService, DirectionsRenderer }] = await Promise.all([
        google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        google.maps.importLibrary("routes") as Promise<google.maps.RoutesLibrary>,
      ])
      if (cancelled) return

      const service    = new DirectionsService()
      const travelMode = routeMode === "DRIVING"
        ? google.maps.TravelMode.DRIVING
        : google.maps.TravelMode.WALKING

      let totalDistM = 0
      let totalDurS  = 0

      await Promise.allSettled(
        pins.slice(0, -1).map(async (pin, i) => {
          try {
            const result = await service.route({
              origin:      { lat: pin.lat,         lng: pin.lng },
              destination: { lat: pins[i+1].lat,   lng: pins[i+1].lng },
              travelMode,
            })
            if (cancelled) return

            const renderer = new DirectionsRenderer({
              map,
              suppressMarkers: true,
              polylineOptions: { strokeColor: "#4a7c35", strokeWeight: 5, strokeOpacity: 0.85 },
            })
            renderer.setDirections(result)
            renderersRef.current.push(renderer)

            const leg = result.routes[0]?.legs[0]
            if (leg?.distance && leg?.duration) {
              totalDistM += leg.distance.value
              totalDurS  += leg.duration.value

              const midLat = (leg.start_location.lat() + leg.end_location.lat()) / 2
              const midLng = (leg.start_location.lng() + leg.end_location.lng()) / 2
              const label  = new AdvancedMarkerElement({
                map,
                position: { lat: midLat, lng: midLng },
                content:  makeRouteLabelElement(`${fmtDur(leg.duration.value)} · ${fmtDist(leg.distance.value)}`),
              })
              routeLabelsRef.current.push(label)
            }
          } catch {
            // segment unavailable — skip silently
          }
        }),
      )

      if (!cancelled && totalDistM > 0) setRouteStats({ distM: totalDistM, durS: totalDurS })
    }

    drawSegments()
    return () => { cancelled = true }
  }, [routeMode, filterDay]) // re-draw when day filter changes while route is active

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

      {/* Route mode — top-left */}
      {!loading && pinCount >= 2 && (
        <div className="absolute left-3 top-3 flex gap-1.5">
          {(["DRIVING", "WALKING"] as const).map((mode) => {
            const Icon   = mode === "DRIVING" ? Car : Footprints
            const label  = mode === "DRIVING" ? "Driving" : "Walking"
            const active = routeMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setRouteMode((m) => (m === mode ? null : mode))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-card/90 text-muted-foreground hover:bg-card",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Day filter — top-right */}
      {!loading && activeDays.length > 1 && (
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
                onClick={() => setFilterDay((d) => (d === day ? null : day))}
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
            {routeStats
              ? `${fmtDist(routeStats.distM)} · ${fmtDur(routeStats.durS)} total`
              : `${pinCount} ${pinCount === 1 ? "location" : "locations"}`}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function makeRouteLabelElement(text: string): HTMLElement {
  const el = document.createElement("div")
  el.style.cssText = [
    "background:#4a7c35", "color:white",
    "font-size:11px", "font-weight:600",
    "font-family:ui-sans-serif,system-ui,sans-serif",
    "padding:4px 10px", "border-radius:12px",
    "box-shadow:0 2px 6px rgba(0,0,0,0.35)",
    "white-space:nowrap", "pointer-events:none",
    "transform:translateX(-50%)", "letter-spacing:0.01em",
  ].join(";")
  el.textContent = text
  return el
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function fmtDist(meters: number) {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`
}

function fmtDur(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
