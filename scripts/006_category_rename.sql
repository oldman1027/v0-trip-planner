-- 006_category_rename.sql
-- Rename three activity categories to match updated enum:
--   sightseeing → attraction
--   hotel       → accommodation  (activity category only; booking type "hotel" is unchanged)
--   activity    → entertainment

-- ── 1. Add column + default if it somehow doesn't exist yet ──────────────
alter table public.activities
  add column if not exists category text not null default 'other';

alter table public.activities
  add column if not exists is_wishlist boolean not null default false;

alter table public.activities
  add column if not exists booking_id uuid references public.bookings;

-- ── 2. Drop any pre-existing CHECK constraint on category ────────────────
do $$
declare
  c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.activities drop constraint if exists %I', c);
  end loop;
end $$;

-- ── 3. Migrate existing rows ─────────────────────────────────────────────
update public.activities set category = 'attraction'    where category = 'sightseeing';
update public.activities set category = 'accommodation' where category = 'hotel';
update public.activities set category = 'entertainment' where category = 'activity';

-- ── 4. Add updated CHECK constraint ─────────────────────────────────────
alter table public.activities
  add constraint activities_category_check check (
    category in ('food','attraction','transport','accommodation','shopping','entertainment','other')
  );
