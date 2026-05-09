"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Mail, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthCallbackUrl } from "@/lib/auth-url"

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const callbackUrl = next
        ? `${getAuthCallbackUrl()}?next=${encodeURIComponent(next)}`
        : getAuthCallbackUrl()
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl,
        },
      })
      if (signInError) throw signInError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Welcome back</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send a magic link.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <div className="font-serif text-lg">Check your email</div>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <span className="font-medium text-foreground">{email}</span>.
            </p>
            <Button
              variant="ghost"
              className="mt-2 rounded-xl"
              onClick={() => {
                setSent(false)
                setEmail("")
              }}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="rounded-xl" disabled={loading || !email}>
              {loading ? (
                <>
                  <Spinner className="mr-2 size-4" /> Sending link...
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
