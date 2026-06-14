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
- Board view (Morning/Afternoon/Night blocks) with emoji headers (🌅☀️🌙)
- BLOCK_START_TIMES: morning=08:00, afternoon=13:00, night=19:00
- Drag and drop activities — sets start_time on drop
- Auto-group activities into correct time block based on start_time:
  - Morning: 00:00–11:59, Afternoon: 12:00–17:59, Night: 18:00–23:59
- Activities sorted by start_time within each time block (localeCompare, no-time items last)
- Category filters: All | Accommodation | Transport | Dining | Experiences | Other
  ✅ STANDARDISED 2026-06: 5 categories everywhere (merged Sightseeing+Activities→Experiences)
  DB values: accommodation | transport | dining | experiences | other
- Real-time sync (LIVE indicator) ✅ fixed
- Selected day card: deep teal bg (#6D8F87), ALL text white, badge = white bg + green number
- Day list shows first-activity preview text under date
- Board layout (desktop): [Day list ~260-280px] [Activity content flex-1] [KIV panel ~220px]
- KIV (Keep in View) right side panel — see section 14
- Activity cards: left color accent bar by category (3px):
  dining=orange-400, transport=slate-400, accommodation=purple-400,
  experiences=blue-400, other=gray-200
  ⚠️ PENDING: accent bars only render on some cards; filter chips alignment with
  Day 1 box still not fixed after 3 attempts (needs Code tab diagnosis)

### 3. Itinerary Planning — Calendar View
- Time-based calendar grid (6am–11pm)
- Accommodation bands spanning multiple day columns at top (fixed stacking/overlap)
- Activity cards: title wraps to 2 lines (line-clamp-2), time range, duration
- Duration inline with time: 09:00 – 10:30 (1h 30m)
- Card height capped to time slot (no overflow past end time)
- Gap indicators between consecutive activities:
  - Vertical line connecting blocks
  - 🚗 drive time · Xm left (Distance Matrix API via GOOGLE_MAPS_SERVER_KEY)
  - "left" = gap minus drive time = truly free time after driving
  - ⚠️ shown if buffer is negative (tight timing)
  - Plain text only, no pill/box border
  - Always shown regardless of gap size
- ✅ Map side panel REMOVED from Calendar (2026-06) — Map is now standalone tab
- KIV sticky right column (dashed border, 140px) — shares data with Board KIV
- Sticky header: navbar + category tabs only (trip info bar scrolls away)
- Removed noisy "~30m available" gap labels between blocks

### 3b. Itinerary Planning — Map Tab ✅ NEW (2026-06)
- Standalone 3rd view: Board | Calendar | Map
- Layout: full map left + right sidebar (day filter tabs D1-D8/All + activity list by day)
- Auto-zoom fitBounds when clicking day filter (padding right:320 for sidebar)
- Single pin day: setCenter + zoom 14; multi-pin: fitBounds with zoom cap 15
- Click pin → opens activity edit panel
- Click sidebar activity → panTo pin + opens edit panel
- Auto-fit all pins on initial Map tab load (300ms delay)

### 4. Map Integration (Google Maps)
- Numbered pins matching activities, day color coding
- Day filter (D1-D8, All) with auto-zoom to day's pins
- Routes between locations
- Now lives in standalone Map tab (Show/Hide toggle removed from Calendar)

### 5. Bookings Management
- Categories: Accommodation, Transport, Dining, Experiences, Other (standardised with itinerary)
- Fields: confirmation_number, booking_url, check_in/out dates+times,
  departure/arrival datetime, from/to locations, amount+currency toggle (THB/MYR),
  payment status, cancel_by, notes
- ✅ REDESIGNED (2026-06): timeline view grouped by date
- reservation_status column: confirmed | pending | tbc | cancelled
- Unified reservation logic across ALL booking types:
  - Confirmation# present OR dropdown=confirmed → "Confirmed" badge
  - Typing confirmation# auto-sets dropdown to confirmed
- Plain-text status colors: Confirmed=green, Pending/TBC=amber, Cancelled=red
- Quick-toggle circle button per row (click to confirm/unconfirm)
- Auto-created booking from activity syncs name/date/time/location (one-way,
  doesn't overwrite booking-specific fields); linked via linked_activity_id
- Autosave on outside click + field blur (isDirty tracking)
- PDF attachments open in new tab via window.open (lightbox removed — had scroll bugs)
- Google Places Autocomplete on Transport From/To fields (PlacesAutocompleteInput)
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

### 14. KIV — Keep in View ✅ NEW (2026-06)
- Unscheduled activities + freeform notes (no day/time)
- DB: activities.is_kiv boolean + kiv_notes table (trip_id, content, created_by)
- Board view: RIGHT side panel (~220px, always visible, no scrolling needed)
  - Was bottom drawer originally — moved to right panel per user request
- Calendar view: sticky right dashed column (140px)
- Drag activity INTO KIV → is_kiv=true, day cleared
- Drag OUT to a day OR click "Assign" → day picker popover
- KIV cards: dashed border, opacity-70, "KIV" label; notes: amber tint
- "Add idea..." + "Add note" buttons in panel
- State lifted to parent itinerary page — shared between Board and Calendar

### 15. Trip Version History ✅ NEW (2026-06)
- trip_history table: jsonb snapshot of activities+bookings after every change
- Records: action (added/edited/deleted/moved), entity_type, entity_name, changed_by_name
- 30-day retention (auto-cleanup on insert)
- History panel: right slide-in, grouped by date, hover → ↩ Restore button
- Restore: confirm dialog → wipes current activities/bookings → re-inserts snapshot
- History button in left sidebar (with Share + Export)
- RLS policies applied (collaborators read, authenticated insert, owner delete)

### 16. Share & Export ✅ NEW (2026-06)
- Share dropdown: read-only link (share_token + 30-day expiry + revoke,
  strips confirmation#/costs/notes, noindex), WhatsApp/Telegram share
  (wa.me, max 3 days preview, no booking refs), invite collaborator
- Export dropdown: client-side jsPDF itinerary (no sensitive data),
  .ics with TZID=Asia/Bangkok, CSV with UTF-8 BOM + injection sanitisation
- Red team safeguards applied; public trip page deferred (privacy risk)

### 17. Trip Page Layout ✅ REDESIGNED (2026-06)
- Desktop: left sidebar (~30%, max-w-xs) + right content (~70%)
- Sidebar contains: hero image, trip meta (destination/dates/cost),
  collaborator avatars ("3 members"), nav (Itinerary/Overview/Bookings/Costs),
  bottom actions (Share/Export/History)
- Mobile: sidebar hidden, horizontal pill tabs at top + compact hero
- Old full-width hero + horizontal tab bar removed on desktop
- Board/Calendar/Map sub-tabs stay inside Itinerary content area
- Toolbar row: filter chips (left) + view switcher (right) on same row

## Database Schema (Supabase)

### Tables:
- trips (id, name, destination, start_date, end_date, created_by, currency, cover_image_url, share_token, share_token_expires_at, share_enabled, is_public)
- activities (id, trip_id, user_id, title, category, day_date, start_time, end_time, location, photo_url, cost, notes, linked_booking_id, block, is_kiv)
- bookings (id, trip_id, user_id, category, name, departure_date, arrival_date, check_in_date, check_out_date, booking_date, from_location, to_location, amount, currency, payment_status, reservation_status, confirmation_number, booking_url, cancel_by, notes, property_name, address, check_in_time, check_out_time, linked_activity_id)
- kiv_notes (id, trip_id, content, created_at, created_by) ✅ NEW
- trip_history (id, trip_id, changed_by, changed_by_name, action, entity_type, entity_name, snapshot jsonb, created_at) ✅ NEW
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

### ⚠️ CRITICAL: Category handling (2026-06)
- activities_category_check constraint was DROPPED — caused repeated save failures
- Replaced with BEFORE INSERT/UPDATE trigger: normalise_activity_category()
- Trigger maps ANY input to: accommodation | transport | dining | experiences | other
  ('food'→dining, 'sightseeing'/'activity'→experiences, 'hotel'→accommodation, etc.)
- Bad values can NEVER reach a constraint — bug is impossible at DB level
- Form initial state must still default category to 'other' (not '' or undefined)
- Root cause of original bug: form initial state defaulted to '' / UI labels like
  'Food & Dining' which violated the old constraint

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
- (2026-06) bookings.reservation_status + linked_activity_id ✅
- (2026-06) trips.share_token_expires_at + share_enabled ✅
- (2026-06) activities.is_kiv + kiv_notes table ✅
- (2026-06) trip_history table + RLS policies ✅
- (2026-06) DROP activities_category_check + normalise_activity_category() trigger ✅
- (2026-06) Category migration: food→dining, sightseeing/activity→experiences, hotel→accommodation ✅

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

### Bugs (active):
1. ⚠️ Filter chips (All/Accommodation/...) NOT left-aligned with Day 1 box —
   3 fix attempts via Chat prompts failed; needs Code tab diagnosis
   (check git log whether commits landed; check for duplicate filter components)
2. ⚠️ Activity card left accent bars only render on some cards (Dining works,
   others missing) — same diagnosis approach needed
3. Calendar gap indicator occasionally overlaps activity cards in tight spaces
4. AI suggest mode sometimes returns wrong city (not always using day location)
5. AI mode detection occasionally mis-routes questions to suggest mode

### Pending Features:
1. Weather integration — FULL PROMPT READY (Open-Meteo, no API key,
   app/api/weather/route.ts, lib/weather-utils.ts WMO mapper,
   hooks/use-trip-weather.ts, daily on Board+Calendar headers, hourly on Overview)
2. Stripe payments (Free/Pro/Team — proposed $6.99/mo Pro, $12.99/mo Team)
3. Custom domain — BLOCKED by rebrand (see below)
4. Mobile full testing
5. Server-side rate limiting on magic link endpoint
6. CAPTCHA on login form
7. PWA support — intentionally deferred (iOS Add to Home Screen works natively)

### 🚨 REBRAND REQUIRED (before launch):
"Tripletto" name taken by identical product. Verified TAKEN:
Tripora (tripora.io/.app), Trippio (trippio.net), Tripio, Voyaj, Wandra.
Clean shortlist: **Vectura** (recommended, Latin "to travel"), **Rovana**, **Itinera**.
NO FINAL NAME CHOSEN YET. Full rebrand checklist needed once picked:
logo, domain, repo, Vercel project, support email, legal pages, OG tags.

### Launch Tasks (in order):
1. Fix 2 active UI bugs (Code tab)
2. Pick rebrand name → execute rebrand
3. Custom domain
4. Weather feature
5. Stripe payments
6. Mobile testing

### Workflow Notes:
- Recurring failure: Claude Code edits files but forgets `git push` —
  ALWAYS verify deploy with `git log origin/main -1`
- For stubborn bugs: use Code tab (reads real files) instead of Chat prompts
- Chat = brainstorm/strategy; Code = implementation/debugging

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
- Category validation now owned by DB trigger normalise_activity_category() —
  the old activities_category_check constraint is GONE
- Categories everywhere: accommodation | transport | dining | experiences | other
- Activity sort within time blocks: [...arr].sort by start_time localeCompare
  (spread to avoid mutation; no-time items pushed last)
- Layout column widths should use CSS vars (--day-list-width, --kiv-panel-width)
  so toolbar/day-list/KIV stay in sync
