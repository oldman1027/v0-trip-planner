# Vercel & Supabase Configuration Guide

## Step 1: Update Vercel Environment Variables

Add or update these environment variables in your Vercel project settings:
https://vercel.com/dashboard/project/settings/environment-variables

**For all environments (Development, Preview, Production):**
- Key: `NEXT_PUBLIC_SITE_URL`
- Value: `https://v0-tripletto.vercel.app`

This replaces the old `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` variable.

## Step 2: Update Supabase Auth Configuration

Go to your Supabase project dashboard:
https://supabase.com/dashboard/project/djhquzxivanoumqcoukl/settings/auth

Under **Authentication > URL Configuration**:

1. **Site URL**: Set to `https://v0-tripletto.vercel.app`

2. **Redirect URLs**: Add these URLs to the allow-list:
   - `https://v0-tripletto.vercel.app/**`
   - `https://v0-tripletto.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (keep for local development)

## Step 3: Verify and Deploy

After updating both Vercel and Supabase:

1. Commit and push your changes (the code already uses the new helper)
2. Trigger a redeployment on Vercel (or just push — it auto-deploys)
3. Test the magic link flow on the production URL

## How It Works

The new `getAuthCallbackUrl()` helper (in `lib/auth-url.ts`) automatically:
- Uses `NEXT_PUBLIC_SITE_URL` if set (for production)
- Falls back to `VERCEL_URL` if available (for preview deployments)
- Falls back to `http://localhost:3000` (for local development)

This means no manual env var changes are needed when deploying to different environments.
