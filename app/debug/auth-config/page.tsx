import { notFound } from "next/navigation"
import { getSiteUrl, getAuthCallbackUrl } from "@/lib/auth-url"

export default function AuthConfigDebugPage() {
  if (process.env.NODE_ENV === "production") notFound()
  const siteUrl = getSiteUrl()
  const callbackUrl = getAuthCallbackUrl()

  return (
    <div className="min-h-svh bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Auth Configuration Debug</h1>
          <p className="text-sm text-muted-foreground">Verify your magic link redirect URLs are configured correctly.</p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <label className="text-sm font-medium">Site URL</label>
            <code className="block mt-2 p-3 bg-muted rounded text-sm font-mono break-all">{siteUrl}</code>
          </div>

          <div>
            <label className="text-sm font-medium">Auth Callback URL</label>
            <code className="block mt-2 p-3 bg-muted rounded text-sm font-mono break-all">{callbackUrl}</code>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold">Environment Variables Used</h2>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <label className="text-muted-foreground">NEXT_PUBLIC_SITE_URL:</label>
              <span className="ml-2">{process.env.NEXT_PUBLIC_SITE_URL || "(not set)"}</span>
            </div>
            <div>
              <label className="text-muted-foreground">VERCEL_URL:</label>
              <span className="ml-2">{process.env.VERCEL_URL || "(not set)"}</span>
            </div>
            <div>
              <label className="text-muted-foreground">VERCEL_ENV:</label>
              <span className="ml-2">{process.env.VERCEL_ENV || "(not set)"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-yellow-500/50 bg-yellow-50/20 p-6 dark:bg-yellow-900/10">
          <h2 className="font-semibold text-yellow-900 dark:text-yellow-100">Required Configuration</h2>
          <ol className="mt-3 space-y-2 text-sm text-yellow-800 dark:text-yellow-200 list-decimal list-inside">
            <li>
              Set <code className="bg-yellow-100/50 dark:bg-yellow-900/30 px-1 rounded">NEXT_PUBLIC_SITE_URL</code> in Vercel to the Site URL above
            </li>
            <li>
              Add the Auth Callback URL above to Supabase Auth → URL Configuration → Redirect URLs
            </li>
            <li>Redeploy the project after making changes</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
