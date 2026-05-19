# Tripletto - AI Travel Planner Project Context

## Project Overview
Tripletto is a full-stack AI-powered group travel planner.

- Production URL: https://v0-tripletto.vercel.app
- GitHub: https://github.com/oldman1027/v0-trip-planner
- Local Path: ~/Job/AI Code/v0-trip-planner
- Tech: Next.js 16.2.4, Supabase, Google Maps API, Tailwind CSS, OpenRouter AI

## Tech Stack
- Framework: Next.js 16.2.4 (Turbopack)
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth (magic links) + Brevo SMTP
- UI: shadcn/ui + Tailwind CSS
- Maps: Google Maps API
- AI: OpenRouter (google/gemini-2.0-flash-exp:free) - currently broken
- Deployment: Vercel
- Package Manager: pnpm
- Real-time: Supabase Realtime (SUBSCRIBED, working in Board view)

## Design System
Tropical Color Palette:
- Turquoise: #8AD0C0, #80d8dd
- Green: #B1DDC6, #27ba76, #369383
- Coral/Pink: #F7A59E, #F2686C, #fca9a9, #de4a66
- Yellow/Orange: #f9d157, #fd7a56
- Brand Color: Tripletto Green #93c572
- Active pills/buttons: bg-teal-500 text-white
- Inactive pills: bg-gray-100 text-gray-600

## Git Push Command
```bash
cd ~/Job/AI\ Code/v0-trip-planner
git remote set-url origin https://YOUR_TOKEN@github.com/oldman1027/v0-trip-planner.git
git push origin main
```
GitHub token expires: ~1 year from May 2026

## Email: Brevo SMTP
- Host: smtp-relay.brevo.com
- Port: 587
- Username: ab2683001@smtp-brevo.com
- Configured in Supabase + Vercel env vars

## Environment Variables (All Set in Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
- OPENROUTER_API_KEY
- NEXT_PUBLIC_SITE_URL=https://v0-tripletto.vercel.app
- BREVO_SMTP_USER
- BREVO_SMTP_PASSWORD

## Features Built ✅

### 1. Trip Management
- Create/edit/delete trips (owner only can delete)
- Multiple trips per user
- Trip collaboration with sharing

### 2. Itinerary Planning
- Board view (Morning/Afternoon/Night blocks)
- Calendar view (time-based, with map side panel)
- Toggle map button (show/hide)
- Category filters: All|Accommodation|Transport|Dining|Activities|Shopping|Entertainment|Other
- Real-time sync (LIVE indicator) - works in Board, Calendar still being fixed
- Drag and drop activities

### 3. Map Integration (Google Maps)
- Numbered pins matching calendar activities
- Day filter (D1-D8, All)
- Routes between locations
- Driving/Walking toggle REMOVED

### 4. Bookings Management
Categories: Accommodation, Transport, Dining, Activities, Other
Fields: confirmation_number, booking_url, check_in/out dates+times, departure/arrival datetime, from/to locations, amount+currency toggle (THB/MYR), payment status, cancel_by, notes
Views: List view + Card view (toggle)
File Attachments: Drag & drop, any file type, stored in Supabase Storage 'booking-attachments' bucket
"Add to itinerary" checkbox (default checked) - creates calendar activity on save

### 5. Costs Tracking
Per-Category Budgets: Accommodation, Transport, Food→Dining, Activities, Other
Expense Splitting: Members system, equal split, debt tracking
Who Owes Whom summary

### 6. Collaboration
- Share via email invite or shareable link
- In-app notifications (bell icon)
- Settings page shows Travelers list (owner + collaborators)
- Owner can remove collaborators, others can leave
- LIVE real-time indicator

### 7. User Profile
- Edit Profile modal: display name + avatar upload
- Avatar stored in Supabase Storage 'avatars' bucket
- Sign out in user menu dropdown

### 8. Auth
- Magic link via Brevo SMTP (no rate limits)
- auth/callback route handles redirect to /trips
- proxy.ts handles session refresh (NOT middleware.ts - causes conflict in Next.js 16)

## Database Schema (Supabase)

### Tables:
- trips (id, name, destination, start_date, end_date, created_by, currency, cover_image_url, share_token, is_public)
- activities (id, trip_id, user_id, title, category, day_date, start_time, end_time, location, photo_url, cost, notes, linked_booking_id)
- bookings (id, trip_id, user_id, category, name, departure_date, arrival_date, check_in_date, check_out_date, booking_date, from_location, to_location, amount, currency, payment_status, confirmation_number, booking_url, cancel_by, notes, property_name, address, check_in_time, check_out_time)
- expenses (id, trip_id, user_id, amount, category, description, paid_by_participant_id, date)
- expense_splits (id, expense_id, participant_id, amount, settled)
- expense_participants (id, trip_id, name, email)
- expense_settlements (id, trip_id, from_participant_id, to_participant_id, amount, settled_at)
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

### Real-time:
- activities table: supabase_realtime publication ✅
- REPLICA IDENTITY FULL ✅
- hooks/use-realtime-activities.ts created
- Unique channel name per mount (fixes StrictMode collision)

## Key Files

### Auth:
- app/auth/callback/route.ts - exchanges code, redirects to /trips
- proxy.ts (root) - session refresh (NOT middleware.ts!)
- lib/auth-url.ts - uses window.location.origin fallback

### Real-time:
- hooks/use-realtime-activities.ts
- components/trip/itinerary/itinerary-board.tsx

### Bookings:
- components/trip/bookings/booking-attachments.tsx
- lib/supabase/booking-attachments.ts

### Collaboration:
- lib/supabase/trip-shares.ts
- components/trip/share-trip-dialog.tsx
- components/trip/collaborators-section.tsx
- app/join/[token]/page.tsx

### Email:
- lib/email.ts - Brevo SMTP via nodemailer
- app/api/send-invitation/route.ts

## Known Issues / Pending

### Bugs:
1. Calendar view real-time not syncing (Board works, Calendar has own state)
2. Board drag → Calendar time not updating (Morning=08:00, Afternoon=13:00, Night=19:00)
3. Collaborators not showing in Settings (only owner visible)
4. AI Trip Planner broken (OpenRouter errors)

### Pending Features:
1. Transport new form → match edit form fields
2. Attachments in new booking forms (currently only in edit)
3. Accommodation bands on calendar (hotel pills spanning day columns)
4. Who's online presence indicator
5. Trip card collaborator avatars
6. Mobile full testing

### Launch Tasks:
1. Custom domain (tripletto.app)
2. Stripe payments (Free/Pro/Team tiers)
3. Privacy policy + Terms of Service
4. Landing page pricing section

## Quick Commands

Start dev server:
```bash
cd ~/Job/AI\ Code/v0-trip-planner && pnpm dev
```

Push to production:
```bash
cd ~/Job/AI\ Code/v0-trip-planner
git add .
git commit -m "msg"
git remote set-url origin https://TOKEN@github.com/oldman1027/v0-trip-planner.git
git push origin main
```

Check Vercel: https://vercel.com/oldman1027-projects/v0-trip-planner
Supabase: https://supabase.com/dashboard/project/djhquzxivanoumqcoukl

## Important Notes
- proxy.ts at root = Next.js 16 middleware (NOT middleware.ts - causes build error)
- trips table uses 'created_by' (not 'user_id') for owner
- Brevo SMTP: no rate limits, 300 emails/day free
- GitHub tokens expire ~May 2026 (just renewed)
- pnpm store is at ~/.pnpm-store
- Supabase project: supabase-orange-queen
