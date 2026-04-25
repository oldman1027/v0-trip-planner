-- Trip Planner schema
-- Tables: profiles, trips, trip_members, activities, bookings

-- profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- trips
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  cover_image_url text,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

-- trip_members
create table if not exists public.trip_members (
  trip_id uuid references public.trips on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text check (role in ('owner','editor','viewer')) default 'editor',
  joined_at timestamptz default now(),
  primary key (trip_id, user_id)
);

-- activities
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips on delete cascade not null,
  day_date date not null,
  time_block text check (time_block in ('morning','afternoon','night')) not null,
  position int default 0,
  title text not null,
  location text,
  start_time time,
  end_time time,
  notes text,
  cost_amount numeric,
  cost_currency text default 'USD',
  photo_url text,
  created_at timestamptz default now()
);

-- bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips on delete cascade not null,
  type text check (type in ('hotel','flight','transport','other')) not null,
  title text not null,
  details jsonb,
  amount numeric,
  currency text default 'USD',
  payment_status text check (payment_status in ('pending','paid','partial')) default 'pending',
  cancellation_deadline timestamptz,
  created_at timestamptz default now()
);

-- indexes
create index if not exists activities_trip_idx on public.activities (trip_id, day_date, time_block, position);
create index if not exists trip_members_user_idx on public.trip_members (user_id);
create index if not exists bookings_trip_idx on public.bookings (trip_id);

-- enable RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.activities enable row level security;
alter table public.bookings enable row level security;
