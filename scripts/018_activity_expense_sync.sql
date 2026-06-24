-- Link expenses to itinerary activities so activity-card costs show up in the Costs tab

alter table public.expenses
  add column if not exists activity_id uuid references public.activities(id) on delete cascade;

alter table public.expenses
  add column if not exists source_type text not null default 'manual';

-- Backfill source_type for existing booking-sourced expenses
update public.expenses
  set source_type = 'booking'
  where booking_id is not null and source_type = 'manual';

-- One expense row per linked activity (upsert target for the sync logic)
create unique index if not exists expenses_activity_unique
  on public.expenses (activity_id) where activity_id is not null;

create index if not exists expenses_activity_idx on public.expenses (activity_id);
