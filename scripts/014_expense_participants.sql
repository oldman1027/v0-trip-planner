-- 014_expense_participants.sql
-- Free-form expense participants for cost splitting (distinct from auth-user trip_members)

-- Create expense_participants table
create table if not exists public.expense_participants (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid references public.trips on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

create index if not exists expense_participants_trip_idx
  on public.expense_participants (trip_id);

-- Drop old unique constraint on expense_splits before modifying columns
alter table public.expense_splits
  drop constraint if exists expense_splits_expense_id_user_id_key;

-- Make user_id nullable (existing splits keep their user_id; participant splits set it to null)
alter table public.expense_splits
  alter column user_id drop not null;

-- Make paid_by_user_id nullable on expenses (participant-paid expenses set it to null)
alter table public.expenses
  alter column paid_by_user_id drop not null;

-- Add participant support to expense_splits
alter table public.expense_splits
  add column if not exists participant_id uuid references public.expense_participants(id) on delete cascade,
  add column if not exists settled        boolean not null default false;

-- Add participant payer support to expenses
alter table public.expenses
  add column if not exists paid_by_participant_id uuid references public.expense_participants(id) on delete set null;

-- Recreate uniqueness as partial indexes (nulls are ignored in unique constraints anyway,
-- but explicit partial indexes make intent clear)
create unique index if not exists expense_splits_user_unique
  on public.expense_splits(expense_id, user_id) where user_id is not null;

create unique index if not exists expense_splits_participant_unique
  on public.expense_splits(expense_id, participant_id) where participant_id is not null;

-- Create settlements table for tracking paid debts
create table if not exists public.settlements (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid references public.trips on delete cascade not null,
  from_participant_id uuid references public.expense_participants(id) on delete cascade not null,
  to_participant_id   uuid references public.expense_participants(id) on delete cascade not null,
  amount              numeric(10,2) not null check (amount > 0),
  currency            text not null default 'THB',
  settled_at          timestamptz default now(),
  notes               text
);

create index if not exists settlements_trip_idx on public.settlements (trip_id);

-- RLS for expense_participants
alter table public.expense_participants enable row level security;

drop policy if exists participants_select on public.expense_participants;
drop policy if exists participants_all    on public.expense_participants;

create policy participants_select on public.expense_participants
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy participants_all on public.expense_participants
  for all using (public.is_trip_member(trip_id, auth.uid()));

-- RLS for settlements
alter table public.settlements enable row level security;

drop policy if exists settlements_select on public.settlements;
drop policy if exists settlements_all    on public.settlements;

create policy settlements_select on public.settlements
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy settlements_all on public.settlements
  for all using (public.is_trip_member(trip_id, auth.uid()));
