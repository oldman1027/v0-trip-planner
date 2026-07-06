"use client"

import { useState, useEffect, useRef } from "react"
import { WifiOff, X, Download, MoreVertical, Smartphone, Share2 } from "lucide-react"
import { BottomTabBar, type MobileTab } from "./components/bottom-tab-bar"
import { TodayTab } from "./components/today-tab"
import { AllDaysTab } from "./components/all-days-tab"
import { BookingsTab } from "./components/bookings-tab"
import { CostsTab } from "./components/costs-tab"
import { MapTab } from "./components/map-tab"
import { saveMobileCache, loadMobileCache, formatSyncTime, getInstallDismissed, setInstallDismissed } from "@/lib/mobile-cache"
import type { Activity, Booking, Expense, MemberWithProfile, Trip } from "@/lib/types"
import type { WeatherData } from "@/lib/weather"

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function MobileShell({
  trip,
  activities: serverActivities,
  bookings: serverBookings,
  expenses: serverExpenses,
  members,
  weather,
}: {
  trip: Trip
  activities: Activity[]
  bookings: Booking[]
  expenses: Expense[]
  members: MemberWithProfile[]
  weather: WeatherData | null
}) {
  const [tab, setTab] = useState<MobileTab>("today")
  const [isOnline, setIsOnline] = useState(true)
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [activities, setActivities] = useState<Activity[]>(serverActivities)
  const [bookings, setBookings] = useState<Booking[]>(serverBookings)
  const [expenses, setExpenses] = useState<Expense[]>(serverExpenses)
  const [showInstall, setShowInstall] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // Remember this trip so the PWA start page can deep-link back here
  useEffect(() => {
    localStorage.setItem("pwa_last_trip", trip.id)
  }, [trip.id])

  // Track online status
  useEffect(() => {
    function onOnline() { setIsOnline(true) }
    function onOffline() { setIsOnline(false) }
    setIsOnline(navigator.onLine)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // Save to cache when we have fresh server data
  useEffect(() => {
    if (serverActivities.length || serverBookings.length || serverExpenses.length) {
      saveMobileCache(trip.id, {
        activities: serverActivities,
        bookings: serverBookings,
        expenses: serverExpenses,
      })
      setSyncedAt(Date.now())
    }
  }, [trip.id, serverActivities, serverBookings, serverExpenses])

  // If offline, try cache
  useEffect(() => {
    if (!navigator.onLine) {
      const cached = loadMobileCache(trip.id)
      if (cached) {
        setActivities(cached.activities)
        setBookings(cached.bookings)
        setExpenses(cached.expenses)
        setSyncedAt(cached.syncedAt)
      }
    }
  }, [trip.id])

  // PWA install prompt
  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    setIsIOS(ios)
    setIsInstalled(standalone)

    // Register service worker — required for Chrome to fire beforeinstallprompt
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    // Always capture the beforeinstallprompt event regardless of dismissed state
    function onPrompt(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      // Only auto-show if not previously dismissed by user
      if (!getInstallDismissed()) setShowInstall(true)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)

    // iOS auto-show (only if not installed and not dismissed)
    if (ios && !standalone && !getInstallDismissed()) {
      setTimeout(() => setShowInstall(true), 2000)
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  async function handleInstall() {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      deferredPrompt.current = null
      if (outcome === "accepted") setInstallDismissed()
      setShowInstall(false)
    } else {
      // iOS or Android where prompt isn't ready yet — sheet shows manual instructions
      setShowInstall(false)
    }
  }

  function dismissInstall() {
    setInstallDismissed()
    setShowInstall(false)
  }

  return (
    <div
      className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col"
      style={{ background: "#FFFBF4" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "0.5px solid #E8E0D8", background: "#FFFBF4" }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight" style={{ color: "#2C4A45" }}>
            {trip.name}
          </p>
          {trip.destination && (
            <p className="truncate text-[11px]" style={{ color: "#9BA8A6" }}>{trip.destination}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowMenu(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:bg-black/[0.06]"
          aria-label="More options"
          style={{ color: "#6D8F87" }}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      {/* Dropdown menu overlay */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="fixed right-4 top-14 z-[91] min-w-[200px] rounded-2xl py-1 shadow-xl"
            style={{ background: "#FDFAF6", border: "0.5px solid #D4C9BC" }}
          >
            <button
              type="button"
              onClick={() => { setShowMenu(false); setShowInstall(true) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm active:bg-black/[0.04]"
              style={{ color: "#2C4A45" }}
            >
              <Smartphone className="h-4 w-4 shrink-0" style={{ color: "#6D8F87" }} />
              Add to Home Screen
            </button>
          </div>
        </>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{ background: "#FEF3C7", borderBottom: "0.5px solid #FDE68A" }}
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" style={{ color: "#D97706" }} />
          <span style={{ color: "#92400E" }}>
            You&apos;re offline — showing last synced data
            {syncedAt ? ` · ${formatSyncTime(syncedAt)}` : ""}
          </span>
        </div>
      )}

      {/* Scrollable content area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        {tab === "today" && (
          <TodayTab
            trip={trip}
            activities={activities}
            expenses={expenses}
            members={members}
            weather={weather}
            bookings={bookings}
          />
        )}
        {tab === "all" && (
          <AllDaysTab
            trip={trip}
            activities={activities}
            weather={weather}
            bookings={bookings}
            members={members}
          />
        )}
        {tab === "bookings" && <BookingsTab bookings={bookings} tripId={trip.id} />}
        {tab === "costs" && (
          <CostsTab trip={trip} expenses={expenses} bookings={bookings} />
        )}
        {tab === "map" && (
          <MapTab trip={trip} activities={activities} />
        )}
      </div>

      {/* Bottom tab bar */}
      <BottomTabBar active={tab} onChange={setTab} />

      {/* Install bottom sheet */}
      {showInstall && !isInstalled && (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] mx-auto max-w-[430px] rounded-t-2xl px-5 pt-4 shadow-xl"
          style={{
            background: "#FDFAF6",
            borderTop: "0.5px solid #D4C9BC",
            paddingBottom: `calc(20px + env(safe-area-inset-bottom))`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#2C4A45" }}>
                Add to Home Screen
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "#9BA8A6" }}>
                Quick access during your trip — works offline too.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInstall}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ color: "#9BA8A6" }}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isIOS ? (
            // iOS Safari: manual Share → Add to Home Screen flow
            <>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { icon: <Share2 className="h-4 w-4" />, text: 'Tap the Share icon at the bottom of Safari' },
                  { icon: <Download className="h-4 w-4" />, text: 'Scroll down and tap "Add to Home Screen"' },
                  { icon: <Smartphone className="h-4 w-4" />, text: 'Tap "Add" to confirm' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#EDF5F2" }}>
                    <span style={{ color: "#6D8F87" }}>{step.icon}</span>
                    <span className="text-xs" style={{ color: "#2C4A45" }}>{step.text}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleInstall}
                className="mt-3 w-full rounded-xl py-3 text-sm font-medium text-white"
                style={{ background: "#6D8F87" }}
              >
                Got it
              </button>
            </>
          ) : deferredPrompt.current ? (
            // Android Chrome: native install prompt available
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"
                style={{ background: "#6D8F87" }}
              >
                <Download className="h-4 w-4" />
                Install app
              </button>
              <button
                type="button"
                onClick={dismissInstall}
                className="rounded-xl px-4 py-3 text-sm font-medium"
                style={{ color: "#9BA8A6", background: "#EDF5F2" }}
              >
                Not now
              </button>
            </div>
          ) : (
            // Android: prompt not ready yet — show manual instructions
            <>
              <div className="mt-3 flex flex-col gap-2">
                {[
                  { icon: <span className="text-base">⋮</span>, text: 'Tap the menu (⋮) in the top-right of Chrome' },
                  { icon: <Download className="h-4 w-4" />, text: 'Tap "Add to Home screen"' },
                  { icon: <Smartphone className="h-4 w-4" />, text: 'Tap "Add" to confirm' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#EDF5F2" }}>
                    <span style={{ color: "#6D8F87" }}>{step.icon}</span>
                    <span className="text-xs" style={{ color: "#2C4A45" }}>{step.text}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowInstall(false)}
                className="mt-3 w-full rounded-xl py-3 text-sm font-medium text-white"
                style={{ background: "#6D8F87" }}
              >
                Got it
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
