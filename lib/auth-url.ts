/**
 * Get the site URL for the application.
 * Priority: NEXT_PUBLIC_SITE_URL > VERCEL_URL > localhost
 * NOTE: On the client side, we do NOT use window.location.origin because
 * email magic link redirects may execute in random environments (email clients, etc).
 * Always use the explicit env var for consistent redirect URLs.
 */
export function getSiteUrl(): string {
  // Use explicit env var first (set in Vercel for production)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // Fallback to Vercel URL for preview/staging
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    const protocol = process.env.VERCEL_ENV === "production" ? "https" : "https"
    return `${protocol}://${vercelUrl}`
  }

  // Local development
  return "http://localhost:3000"
}

/**
 * Get the redirect URL for Supabase Auth callbacks.
 * Uses getSiteUrl() to ensure consistent redirects across all environments.
 */
export function getRedirectUrl(): string {
  return getSiteUrl()
}

/**
 * Get the callback URL for Supabase Auth redirects (e.g., magic link, OAuth)
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`
}
