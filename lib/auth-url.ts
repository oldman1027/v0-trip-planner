/**
 * Get the redirect URL for Supabase Auth callbacks.
 * Priority: NEXT_PUBLIC_SITE_URL > VERCEL_URL > localhost
 */
export function getRedirectUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side: use window.location.origin for dynamic redirects
    return window.location.origin
  }

  // Server-side or static generation
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    return siteUrl
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    const protocol = process.env.VERCEL_ENV === "production" ? "https" : "https"
    return `${protocol}://${vercelUrl}`
  }

  return "http://localhost:3000"
}

/**
 * Get the callback URL for Supabase Auth redirects (e.g., magic link, OAuth)
 */
export function getAuthCallbackUrl(): string {
  return `${getRedirectUrl()}/auth/callback`
}
