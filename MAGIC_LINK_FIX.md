# Magic Link Redirect Fix

## Problem
Magic link emails were being sent with redirect URLs set to `http://localhost:3000` instead of the production URL `https://v0-tripletto.vercel.app`.

## Root Cause
The auth flow was using `window.location.origin` on the client side to determine the redirect URL. When email clients (Gmail, Outlook, etc.) open magic links, they may run in a different environment (even localhost in some cases), causing the origin to be wrong.

## Solution Applied

### Code Fix (Completed ✓)
- Updated `lib/auth-url.ts` to use **explicit environment variables only**, never `window.location.origin`
- Priority: `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `http://localhost:3000`
- This ensures redirect URLs are consistent across all environments

### Supabase Configuration (Manual - Required Now)

#### Step 1: Set Vercel Environment Variable
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/update variable: `NEXT_PUBLIC_SITE_URL`
   - **Value**: `https://v0-tripletto.vercel.app`
   - **Environment**: Production, Preview, Development
3. **Redeploy** the project

#### Step 2: Configure Supabase Auth URLs
1. Go to **Supabase Dashboard** → Your Project → **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://v0-tripletto.vercel.app`
3. Add to **Redirect URLs**:
   ```
   https://v0-tripletto.vercel.app/**
   https://v0-tripletto.vercel.app/auth/callback
   ```
4. **Save** the configuration

## Why Both Are Needed

- **Vercel Env Var**: Tells your Next.js app what domain to use for building redirect URLs
- **Supabase URL Config**: Tells Supabase which redirect URLs are valid (security whitelist)

Without Supabase configuration, the magic link works but Supabase will reject the session exchange if the redirect doesn't match the whitelist.

## Verification

After deployment, test:
1. Send a test magic link email from the login page
2. Check the email — the link should contain your production URL
3. Click the link — you should be redirected to your production app, not localhost

## Files Changed
- `lib/auth-url.ts`: Rewrote to use env vars exclusively, never `window.location.origin`
