"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import Image from "next/image"
import { Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthCallbackUrl } from "@/lib/auth-url"
import { toast } from "sonner"

const COOLDOWN = 60
const LS_UNTIL = "tripletto_otp_until"
const LS_EMAIL  = "tripletto_otp_email"

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Sign-in link has expired or was already used. Please request a new one.",
  no_code:     "Invalid sign-in link. Please request a new one.",
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export function LoginForm({
  next,
  initialError,
  initialEmail,
  isReturningUser,
}: {
  next?: string
  initialError?: string
  initialEmail?: string
  isReturningUser?: boolean
}) {
  const [email, setEmail]           = useState(initialEmail ?? "")
  const [magicLoading, setMagicLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent]             = useState(false)
  const [countdown, setCountdown]   = useState(0)
  const [error, setError]           = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? "Sign-in failed. Please try again.") : null,
  )

  // Restore cooldown from localStorage on mount
  useEffect(() => {
    try {
      const until     = parseInt(localStorage.getItem(LS_UNTIL) ?? "0", 10)
      const remaining = Math.ceil((until - Date.now()) / 1000)
      if (remaining > 0) {
        const saved = localStorage.getItem(LS_EMAIL)
        if (saved && !initialEmail) setEmail(saved)
        setSent(true)
        setCountdown(remaining)
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick down one second at a time
  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl() + (next ? `?next=${encodeURIComponent(next)}` : ""),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
    if (oauthError) {
      toast.error("Could not connect to Google. Try magic link instead.")
      setGoogleLoading(false)
    }
    // On success the browser navigates away — no need to reset loading
  }

  async function sendLink(target: string) {
    if (magicLoading) return
    setMagicLoading(true)
    setError(null)
    try {
      const supabase    = createClient()
      const base        = getAuthCallbackUrl()
      const callbackUrl = next ? `${base}?next=${encodeURIComponent(next)}` : base
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: target,
        options: { emailRedirectTo: callbackUrl },
      })
      if (signInError) throw signInError
      localStorage.setItem(LS_UNTIL, String(Date.now() + COOLDOWN * 1000))
      localStorage.setItem(LS_EMAIL,  target)
      setSent(true)
      setCountdown(COOLDOWN)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setMagicLoading(false)
    }
  }

  function reset() {
    setSent(false)
    setEmail("")
    setCountdown(0)
    setError(null)
    try {
      localStorage.removeItem(LS_UNTIL)
      localStorage.removeItem(LS_EMAIL)
    } catch {}
  }

  // ── Sent state ──────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary/50 py-6 text-center">
          <span className="text-3xl" aria-hidden>✉️</span>
          <div className="font-serif text-lg">Check your email!</div>
          <p className="max-w-[260px] text-sm text-muted-foreground">
            We sent a magic link to{" "}
            <span className="font-medium text-foreground">{email}</span>.{" "}
            Link expires in 15 minutes.
          </p>
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2">
          {countdown > 0 ? (
            <Button variant="outline" className="rounded-xl" disabled>
              Resend in {countdown}s…
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void sendLink(email)}
              disabled={magicLoading || !email}
            >
              {magicLoading ? (
                <Spinner className="mr-2 size-4" />
              ) : (
                <Mail className="mr-2 h-4 w-4" aria-hidden />
              )}
              Resend magic link
            </Button>
          )}
          <Button variant="ghost" className="rounded-xl" onClick={reset}>
            Use a different email
          </Button>
        </div>
      </div>
    )
  }

  // ── Main login form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Branding */}
      <div className="text-center">
        <Image
          src="/favicon.png"
          alt="Tripletto"
          width={64}
          height={64}
          className="mx-auto rounded-xl object-contain"
        />
        <h1 className="mt-3 font-serif text-2xl font-semibold">Tripletto</h1>
        <p className="mt-1 text-sm text-muted-foreground">Plan group trips together</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {/* Google */}
        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={googleLoading || magicLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {googleLoading ? <Spinner className="size-5" /> : <GoogleIcon />}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Magic link */}
        <form
          onSubmit={(e) => { e.preventDefault(); void sendLink(email) }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
              autoComplete="email"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            variant="outline"
            className="rounded-xl"
            disabled={magicLoading || googleLoading || !email}
          >
            {magicLoading ? (
              <><Spinner className="mr-2 size-4" /> Sending link…</>
            ) : (
              <><Mail className="mr-2 h-4 w-4" aria-hidden /> Send magic link</>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No password needed ✨
        </p>
      </div>
    </div>
  )
}
