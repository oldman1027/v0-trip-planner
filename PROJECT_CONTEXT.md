# Tripletto - AI Travel Planner Project Context

## Project Overview
Tripletto is a full-stack AI-powered group travel planner.

- Production URL: https://v0-tripletto.vercel.app
- GitHub: https://github.com/oldman1027/v0-trip-planner
- Local Path: ~/v0-trip-planner
- Tech: Next.js 16, Supabase, Google Maps API, Tailwind CSS, OpenRouter AI

## Tech Stack
- Framework: Next.js 16.2.4 (Turbopack)
- Database: Supabase (PostgreSQL)
- Auth: Supabase Auth (magic links)
- UI: shadcn/ui + Tailwind CSS
- Maps: Google Maps API
- AI: OpenRouter (google/gemini-2.0-flash-exp:free)
- Deployment: Vercel
- Package Manager: pnpm

## Design System
Tropical Color Palette:
- Turquoise: #8AD0C0, #80d8dd
- Green: #B1DDC6, #27ba76, #369383
- Coral/Pink: #F7A59E, #F2686C, #fca9a9, #de4a66
- Yellow/Orange: #f9d157, #fd7a56

Brand Color: Tripletto Green #93c572

## Features Built

### 1. Trip Management
- Create/edit trips with destination, dates, currency, budget
- Multiple trips per user
- Trip collaboration

### 2. Itinerary Planning
- Calendar view with day columns
- Numbered activity badges matching map pins
- Categories: Food & Dining, Attraction, Transport, Accommodation, Shopping, Entertainment, Other
- Click-to-add menu

### 3. Map Integration (Google Maps)
- Numbered pins matching calendar activities
- Day-grouped colored pins
- Routes between locations

### 4. Bookings Management
Categories: Accommodation, Transport, Dining, Activities, Other

Fields: confirmation_number, booking_url, check_in_time, check_out_time, departure_time, arrival_time

Views: List view + Card view (toggle)

Smart Form: Fields show/hide based on selected type

Cost Integration: Track in Costs checkbox auto-creates linked expense

### 5. Costs Tracking
Per-Category Budgets: Accommodation, Transport, Food, Activities, Other

Expense Splitting: Equal split, Custom split, Debt tracking

Auto-populate expenses from bookings
Manual entry for additional expenses
Filters by category, date, person
Who Owes Whom summary

### 6. AI Trip Planner (Partial)
- Component: components/trip/TriplettoAI.tsx
- API route: app/api/tripletto-ai/route.ts
- Status: Has errors, needs debugging
- Uses OpenRouter API with free Gemini model

### 7. UI/UX
- Max-width container: 1152px
- Responsive padding
- Mobile responsive
- Tropical colors throughout

## Database Schema (Supabase)

Tables:
- trips
- trip_members
- activities
- bookings
- expenses
- expense_splits
- trip_budgets

Migrations:
- 012_costs_schema.sql (APPLIED)
- 013_bookings_improvements.sql (NEEDS TO BE APPLIED)

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
- OPENROUTER_API_KEY
- NEXT_PUBLIC_SITE_URL

## Quick Commands

Start dev server:
cd ~/v0-trip-planner && pnpm dev

Push to production:
cd ~/v0-trip-planner && git add . && git commit -m "msg" && git push origin main

## Known Issues
1. AI Trip Planner returns errors
2. Calendar needs travel_time display
3. Map pins need location labels
4. Mobile testing needed

## Pending Tasks
- Apply 013_bookings_improvements.sql migration
- Push latest changes to Vercel
- Test mobile view
- Fix AI Trip Planner

## Development Notes
- Use Claude Code terminal for coding
- Apply SQL migrations via Supabase Dashboard
- Supabase CLI not installed
- Git configured with oldman1027@gmail.com
