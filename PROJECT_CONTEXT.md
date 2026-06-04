# Tripletto - AI Travel Planner Project Context

## Project Overview
Tripletto is a full-stack AI-powered group travel planner.

- Production URL: https://v0-tripletto.vercel.app
- GitHub: https://github.com/oldman1027/v0-trip-planner
- Local Path: ~/Job/AIProject/v0-trip-planner (renamed from ~/Job/AI Code/v0-trip-planner)
- Tech: Next.js 16.2.4, Supabase, Google Maps API, Tailwind CSS, OpenAI GPT-4o-mini

## Tech Stack
- Framework: Next.js 16.2.4 (Turbopack)
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth (magic links) + Brevo SMTP
- UI: shadcn/ui + Tailwind CSS
- Maps: Google Maps API
- AI: OpenAI GPT-4o-mini (OPENAI_API_KEY) — streaming chat, suggest mode
- Deployment: Vercel
- Package Manager: pnpm
- Real-time: Supabase Realtime (SUBSCRIBED, working in Board + Calendar)

## Design System

### New Color Palette (Sage/Butter/Teal — replaced tropical palette):
- Primary Sage Green: #A9D6C5
- Background Butter: #FFFBF4
- Deep Teal (accent/active buttons): #6D8F87
- Sage hover: #8EC4B2
- Deep teal hover: #5A7870
- Text dark: #2C4A45
- Muted bg: #E8DDD0
- Border: #D4C9BC
- Card bg: #FDFAF6
- Active pills/buttons: bg-[#6D8F87] text-white
- Inactive pills: bg-[#FFFBF4] text-[#6D8F87] border border-[#A9D6C5]

### Old colors kept for danger/delete only:
- Coral/Pink: #F7A59E, #F2686C (delete buttons only)

## Branding
- Logo: Green rounded square icon with 3 people + map pin
- Logo files: public/logo.png, public/favicon.png, public/apple-touch-icon.png, public/icon-192.png, public/icon-512.png
- Support email: hello.tripletto@gmail.com
- Tagline: "Plan the day. Live the moment." / "Make memories, not spreadsheets."

## Git Push Command
```bash
cd ~/Job/AIProject/v0-trip-planner
git remote set-url origin https://YOUR_TOKEN@github.com/oldman1027/v0-trip-planner.git
git push origin main
```
GitHub token expires: ~May 2027

## Email: Brevo SMTP
- Host: smtp-relay.brevo.com
- Port: 587
- Username: ab2683001@smtp-brevo.com
- Configured in Supabase + Vercel env vars

## Environment Variables (All Set in Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser only, HTTP referrer restricted)
- GOOGLE_MAPS_SERVER_KEY (server-side, unrestricted, Distance Matrix API only)
- OPENAI_API_KEY (GPT-4o-mini for AI chat — primary AI)
- OPENROUTER_API_KEY (sk-or-v1-... backup, kept but not primary)
- NEXT_PUBLIC_SITE_URL=https://v0-tripletto.vercel.app
- BREVO_SMTP_USER
- BREVO_SMTP_PASSWORD

## Google Cloud Project
- Project: Trip Planner (trip-planner-494506)
- Enabled APIs: Maps JavaScript API, Places API, Directions API, Geocoding API, Distance Matrix API, Generative Language API
- Maps API Key: HTTP referrer restricted to v0-tripletto.vercel.app/* and localhost:3000/*
- Server Key (GOOGLE_MAPS_SERVER_KEY): No restrictions, Distance Matrix API only

## Features Built ✅

### 1. Trip Management
- Create/edit/delete trips (owner only can delete)
- Multiple trips per user
- Trip collaboration with sharing
- Trip card collaborator avatars (stacked, up to 4 + overflow count)

### 2. Itinerary Planning — Board View
- Board view (Morning/Afternoon/Night blocks)
- BLOCK_START_TIMES: morning=08:00, afternoon=13:00, night=19:00
- Drag and drop activities — sets start_time on drop
- Auto-group activities into correct time block based on start_time:
  - Morning: 00:00–11:59, Afternoon: 12:00–17:59, Night: 18:00–23:59
- Category filters: All | Accommodation | Transport | Dining | Activities | Other
  (Shopping + Entertainment removed from filter tabs but still valid form categories,
   shown under "Other" filter)
- Real-time sync (LIVE indicator) ✅ fixed
- Selected day card: deep teal bg (#6D8F87), ALL text white, badge = white bg + green number

### 3. Itinerary Planning — Calendar View
- Time-based calendar grid (6am–11pm)
- Accommodation bands spanning multiple day columns at top (fixed stacking/overlap)
- Activity cards: title wraps to 2 lines (line-clamp-2), time range, duration
- Gap indicators between consecutive activities:
  - Vertical line connecting blocks
  - 🚗 drive time · Xm left (Distance Matrix API via GOOGLE_MAPS_SERVER_KEY)
  - "left" = gap minus drive time = truly free time after driving
  - ⚠️ shown if buffer is negative (tight timing)
  - Plain text only, no pill/box border
  - Always shown regardless of gap size
- Map side panel: numbered pins, day filter, routes
- Sticky header: navbar + category tabs only (trip info bar scrolls away)
- Removed noisy "~30m available" gap labels between blocks

### 4. Map Integration (Google Maps)
- Numbered pins matching calendar activities
- Day filter (D1-D8, All)
- Routes between locations
- Show/Hide map toggle

### 5. Bookings Management
- Categories: Accommodation, Transport, Dining, Activities, Other
- Fields: confirmation_number, booking_url, check_in/out dates+times,
  departure/arrival datetime, from/to locations, amount+currency toggle (THB/MYR),
  payment status, cancel_by, notes
- Views: List view + Card view (toggle)
- File Attachments: Drag & drop in BOTH new and edit forms, any file type,
  stored in Supabase Storage 'booking-attachments' bucket
- PendingAttachments component for new booking forms
- "Add to itinerary" checkbox (default checked) - creates calendar activity on save
- Transport new form: matches edit form (Confirmation #, Booking URL, Notes)

### 6. Costs Tracking
- Per-Category Budgets: Accommodation, Transport, Food→Dining, Activities, Other
- Dual currency display: THB and MYR shown SEPARATELY — no conversion, sum per currency
- Expense Splitting: Members system, equal split, debt tracking
- Who Owes Whom: per-currency debt tracking (THB and MYR fully separate)
- Settlements grouped by currency with currency label headers
- Shared state: participants lifted to parent costs page (no stale members bug)
- Empty state: prompt to add members when no participants exist
- Duplicate participant fix: deduplicated by id

### 7. Collaboration
- Share via email invite or shareable link
- In-app notifications (bell icon)
- Settings page: Travelers list (owner + collaborators) — fixed PostgREST FK ambiguity
  (trip_members_user_id_profiles_fkey added to resolve auth.users vs profiles conflict)
- Owner can remove collaborators, others can leave
- LIVE real-time indicator
- Who's Online: Supabase Realtime Presence on presence:trip:{tripId} channel
- hooks/use-presence.ts handles presence, shows green dot on online avatars

### 8. AI Trip Planner (Tripletto AI) ✅ FIXED
- Model: OpenAI GPT-4o-mini (~1-2 second responses)
- Streaming responses for chat mode (word by word, blinking cursor)
- Suggest mode: returns activity cards (non-streaming JSON array)
- Smart mode detection in TriplettoAI.tsx:
  - Questions (how long, what is, where is, ?) → chat mode
  - Requests (suggest, find me, places to eat, add to) → suggest mode
  - "Suggest activities" button always forces suggest mode
- Context-aware: sends full activity list with day_date + location to API
- Day-location mapping: AI knows Day 2 = Pattaya if activities are there
- IMPORTANT: OPENAI_API_KEY must be read INSIDE the POST handler (not module level)
- API route: app/api/tripletto-ai/route.ts (uses nodejs runtime, maxDuration: 30)
- react-markdown renders formatted AI responses (bold, bullets)
- "Ask AI" floating button on itinerary page
- History: was OpenRouter → broke due to ZDR policy blocking free models →
  switched to openrouter/free auto-router → switched to OpenAI GPT-4o-mini (final)

### 9. User Profile
- Edit Profile modal: display name + avatar upload
- Avatar stored in Supabase Storage 'avatars' bucket
- Sign out in user menu dropdown

### 10. Auth
- Magic link via Brevo SMTP (no rate limits, 300 emails/day free)
- 60-second cooldown on resend (stored in localStorage as tripletto_otp_until)
- Email stored in localStorage as tripletto_otp_email (survives page refresh)
- Sent state: ✉️ "Check your email!" + "Link expires in 15 minutes"
- Resend button appears after cooldown countdown
- "Use a different email" resets all state
- Context-aware title: isReturningUser ? "Welcome back" : "Start planning your trip"
- ← Back to home link on login page
- auth/callback route handles redirect to /trips
- proxy.ts handles session refresh (NOT middleware.ts — causes build error in Next.js 16)
- lib/auth-url.ts uses window.location.origin fallback

### 11. UX Features
- Undo Delete (toast-based soft delete):
  - 6.5 second delay before actual DB delete
  - Cmd+Z / Ctrl+Z triggers undo of last pending deletion
  - Coral undo button, teal progress bar animation in toast
  - Applied to: activities (board + calendar), bookings
  - Cascade: restores linked booking_id on activity restore
  - hooks/use-undo-delete.ts

- Keyboard Shortcuts:
  - ? → show shortcuts help modal
  - N → open Add Activity/Booking/Expense dialog
  - 1 / 2 → switch Board/Calendar or List/Card view
  - M → toggle map panel (calendar view)
  - Delete/Backspace → delete focused card (requires focused card)
  - Cmd+Enter / Ctrl+Enter → save/submit form
  - Escape → close modal (handled natively by Radix UI shadcn)
  - Guards: disabled when typing in input/textarea/select
  - hooks/use-keyboard-shortcuts.ts
  - components/keyboard-shortcuts-modal.tsx
  - components/keyboard-shortcuts-provider.tsx (mounted in trip layout)

- Autosave on Drawer Close:
  - Detects dirty state (compares current vs original values)
  - Autosaves if title is not empty and isDirty = true
  - Toast: "Changes saved automatically"
  - If title empty: "Add a title to save" + keeps drawer open
  - Applied to: activity drawer, booking drawer

- Activity Photo Handling:
  - "Fetch from Google" button in activity form (Google Places photo)
  - Fallback on broken photo_url: Lucide icon per category (NO emoji)
    - Accommodation: BedDouble, Transport: Plane, Dining: Utensils
    - Activities: MapPin, Shopping: ShoppingBag, Entertainment: Music, Other: MoreHorizontal
  - Icon centered, muted color matching category

### 12. Landing Page ✅ REDESIGNED (app/page.tsx)
5-section marketing page:
- Nav: logo + Features/Pricing anchor links + Sign in button
- Hero: "Because Every Moment Matters" + 2 CTAs ("Start for free" + "See how it works") + social proof line
- How It Works: 3-step cards (Create → Plan → Travel)
- Features: 4-card grid with Lucide icons (Itinerary, Bookings, Costs, Maps)
- Pricing: Free / Pro / Team — paid tiers show "Coming soon" badge, Pro highlighted
- Footer: logo + "Plan together. Travel better." + product links + legal links + "© 2026 Tripletto. Made with ☀️ in Malaysia."

### 13. Legal + Info Pages ✅ NEW
- /privacy — Privacy Policy (Malaysia PDPA compliant, hello.tripletto@gmail.com)
- /terms — Terms of Service (hello.tripletto@gmail.com)
- /about — About page with founder story ("Built by a traveler tired of 47-message threads")
- All pages: consistent nav header + ← Back to home link

## Database Schema (Supabase)

### Tables:
- trips (id, name, destination, start_date, end_date, created_by, currency, cover_image_url, share_token, is_public)
- activities (id, trip_id, user_id, title, category, day_date, start_time, end_time, location, photo_url, cost, notes, linked_booking_id, block)
- bookings (id, trip_id, user_id, category, name, departure_date, arrival_date, check_in_date, check_out_date, booking_date, from_location, to_location, amount, currency, payment_status, confirmation_number, booking_url, cancel_by, notes, property_name, address, check_in_time, check_out_time)
- expenses (id, trip_id, user_id, amount, category, description, paid_by_participant_id, date)
- expense_splits (id, expense_id, participant_id, amount, settled)
- expense_participants (id, trip_id, name, email)
- expense_settlements (id, trip_id, from_participant_id, to_participant_id, amount, settled_at, currency)
- trip_shares (id, trip_id, user_id, role, status, last_activity_at, invited_by_user_id)
- trip_share_links (id, trip_id, token, created_by_user_id)
- trip_invitations (id, trip_id, email, status, invited_by)
- notifications (id, user_id, type, title, message, link, read)
- booking_attachments (id, booking_id, trip_id, user_id, file_name, file_type, file_size, storage_path, public_url)
- profiles (id, full_name, email, avatar_url)

### Migrations Applied:
- 012_costs_schema.sql ✅
- 013_bookings_improvements.sql ✅
- 014_expense_participants.sql ✅
- 015_trip_sharing_and_notifications.sql ✅
- 016_booking_attachments.sql ✅
- Add booking date columns ✅
- Enable realtime for activities ✅ (REPLICA IDENTITY FULL)
- Link activities to user accounts ✅
- trip_members_user_id_profiles_fkey → profiles(id) ✅ (fixes collaborators display)
- expense_settlements currency column ✅

### Real-time:
- activities table: supabase_realtime publication ✅
- REPLICA IDENTITY FULL ✅
- hooks/use-realtime-activities.ts
- Unique channel name per mount (fixes StrictMode collision)

## Key Files

### Auth:
- app/auth/callback/route.ts - exchanges code, redirects to /trips
- proxy.ts (root) - session refresh (NOT middleware.ts!)
- lib/auth-url.ts - uses window.location.origin fallback
- components/auth/login-form.tsx - cooldown, resend, sent state, isReturningUser

### AI:
- app/api/tripletto-ai/route.ts - OpenAI GPT-4o-mini, streaming chat, suggest mode
- app/api/test-env/route.ts - debug endpoint (hasKey, keyLength, keyPrefix)
- components/trip/TriplettoAI.tsx - chat UI, mode detection, dayContext builder
- app/actions/add-ai-activities.ts - inserts AI suggestions into Supabase

### Travel Time (Gap Indicator):
- app/api/travel-time/route.ts - Distance Matrix API (uses GOOGLE_MAPS_SERVER_KEY)
- hooks/use-travel-times.ts - client hook with in-memory Map cache
- components/trip/itinerary/gap-indicator.tsx - renders 🚗 Xm · Ym left

### Real-time & Presence:
- hooks/use-realtime-activities.ts
- hooks/use-presence.ts
- components/trip/itinerary/itinerary-board.tsx

### Bookings:
- components/trip/bookings/booking-attachments.tsx
- components/trip/bookings/pending-attachments.tsx (new booking forms)
- components/trip/bookings/booking-drawer.tsx
- components/trip/bookings/bookings-list.tsx
- lib/supabase/booking-attachments.ts

### Collaboration:
- lib/supabase/trip-shares.ts
- components/trip/share-trip-dialog.tsx
- components/trip/collaborators-section.tsx
- app/join/[token]/page.tsx

### Costs:
- components/trip/costs/costs-client.tsx - shared participants state (lifted)
- components/trip/costs/budget-cards.tsx - dual currency per category
- components/trip/costs/expense-list.tsx - dual currency subtotal bar
- components/trip/costs/settlement-summary.tsx - per-currency settlements

### UX:
- hooks/use-undo-delete.ts - soft delete with 6.5s timeout + Cmd+Z
- hooks/use-keyboard-shortcuts.ts - generic keyboard shortcut hook
- components/keyboard-shortcuts-modal.tsx
- components/keyboard-shortcuts-provider.tsx (mounted in trip layout)

### Email:
- lib/email.ts - Brevo SMTP via nodemailer
- app/api/send-invitation/route.ts

### Legal:
- app/privacy/page.tsx
- app/terms/page.tsx
- app/about/page.tsx

## Known Issues / Pending

### Bugs:
1. Calendar gap indicator occasionally overlaps activity cards in tight spaces
2. AI suggest mode sometimes returns wrong city (not always using day location correctly)
3. AI mode detection occasionally mis-routes questions to suggest mode

### Pending Features:
1. Stripe payments (Free/Pro/Team tiers) — pricing page shows "Coming soon"
2. Custom domain (tripletto.app)
3. Mobile full testing
4. Server-side rate limiting on magic link endpoint
5. CAPTCHA on login form
6. Export trip as PDF
7. Trip card collaborator avatars (who's going)

### Launch Tasks:
1. Custom domain (tripletto.app)
2. Stripe payments
3. Mobile testing

## Quick Commands

Start dev server:
```bash
cd ~/Job/AIProject/v0-trip-planner && pnpm dev
```

Push to production:
```bash
cd ~/Job/AIProject/v0-trip-planner
git add .
git commit -m "msg"
git remote set-url origin https://TOKEN@github.com/oldman1027/v0-trip-planner.git
git push origin main
```

Check Vercel: https://vercel.com/oldman1027-projects/v0-trip-planner
Vercel Logs: https://vercel.com/oldman1027-projects/v0-trip-planner/logs
Supabase: https://supabase.com/dashboard/project/djhquzxivanoumqcoukl
OpenRouter: https://openrouter.ai/workspaces/default/keys
Google Cloud Credentials: https://console.cloud.google.com/apis/credentials?project=trip-planner-494506
Google Cloud APIs: https://console.cloud.google.com/apis/library?project=trip-planner-494506

## Important Notes
- proxy.ts at root = Next.js 16 middleware (NOT middleware.ts - causes build error)
- trips table uses 'created_by' (not 'user_id') for owner
- Brevo SMTP: no rate limits, 300 emails/day free
- GitHub tokens expire ~May 2027
- pnpm store is at ~/.pnpm-store
- Supabase project: supabase-orange-queen (djhquzxivanoumqcoukl)
- OpenAI GPT-4o-mini cost: ~$0.10–0.30 per 1000 messages
- Distance Matrix API: ~$5 per 1000 calls — cached in memory (Map) per session
- GOOGLE_MAPS_SERVER_KEY must have NO HTTP referrer restriction (server-side calls fail otherwise)
- OPENAI_API_KEY must be read INSIDE the POST handler, not at module level (Vercel issue)
- OpenRouter ZDR policy blocks most specific free models — use openrouter/free as fallback
- activities table: block field stores 'morning'|'afternoon'|'night'
- expense_settlements: now has currency column for per-currency debt tracking
