"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthCallbackUrl } from "@/lib/auth-url"

const COOLDOWN = 60
const LS_UNTIL = "tripletto_otp_until"
const LS_EMAIL  = "tripletto_otp_email"

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Sign-in link has expired or was already used. Please request a new one.",
  no_code:     "Invalid sign-in link. Please request a new one.",
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
  const [email, setEmail]       = useState(initialEmail ?? "")
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError]       = useState<string | null>(
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

  async function sendLink(target: string) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const supabase   = createClient()
      const base       = getAuthCallbackUrl()
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
      setLoading(false)
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

  const title = isReturningUser ? "Welcome back" : "Start planning your trip"

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{title}</CardTitle>
        <CardDescription>
          Enter your email — we&apos;ll send you a magic link. No password needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary/50 py-5 text-center">
              <span className="text-3xl" aria-hidden>✉️</span>
              <div className="font-serif text-lg">Check your email!</div>
              <p className="max-w-[260px] text-sm text-muted-foreground">
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.{" "}
                Link expires in 15 minutes.
              </p>
            </div>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

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
                  disabled={loading || !email}
                >
                  {loading ? (
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
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); void sendLink(email) }}
            className="flex flex-col gap-5"
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
            <Button type="submit" className="rounded-xl" disabled={loading || !email}>
              {loading ? (
                <>
                  <Spinner className="mr-2 size-4" /> Sending link…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" aria-hidden /> Send magic link
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
