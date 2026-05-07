-- Costs feature: expenses, splits, budgets

create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid references public.trips on delete cascade not null,
  booking_id       uuid references public.bookings on delete set null,
  amount           numeric not null check (amount > 0),
  currency         text not null default 'USD',
  category         text check (category in ('accommodation','transport','food','activities','other')) not null default 'other',
  date             date not null,
  description      text not null,
  paid_by_user_id  uuid references auth.users not null,
  created_at       timestamptz default now()
);

create table if not exists public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid references public.expenses on delete cascade not null,
  user_id     uuid references auth.users not null,
  amount      numeric not null check (amount >= 0),
  paid        boolean not null default false,
  created_at  timestamptz default now(),
  unique(expense_id, user_id)
);

create table if not exists public.trip_budgets (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid references public.trips on delete cascade not null,
  category       text check (category in ('accommodation','transport','food','activities','other')) not null,
  budget_amount  numeric not null check (budget_amount >= 0),
  created_at     timestamptz default now(),
  unique(trip_id, category)
);

create index if not exists expenses_trip_idx        on public.expenses (trip_id);
create index if not exists expense_splits_exp_idx   on public.expense_splits (expense_id);
create index if not exists trip_budgets_trip_idx    on public.trip_budgets (trip_id);

alter table public.expenses        enable row level security;
alter table public.expense_splits  enable row level security;
alter table public.trip_budgets    enable row level security;

-- expenses
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;

create policy expenses_select on public.expenses
  for select using (public.is_trip_member(trip_id, auth.uid()));
create policy expenses_insert on public.expenses
  for insert with check (public.is_trip_member(trip_id, auth.uid()));
create policy expenses_update on public.expenses
  for update using (public.is_trip_member(trip_id, auth.uid()));
create policy expenses_delete on public.expenses
  for delete using (public.is_trip_member(trip_id, auth.uid()));

-- expense_splits (inherit access from parent expense's trip)
drop policy if exists splits_select on public.expense_splits;
drop policy if exists splits_insert on public.expense_splits;
drop policy if exists splits_update on public.expense_splits;
drop policy if exists splits_delete on public.expense_splits;

create policy splits_select on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );
create policy splits_insert on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );
create policy splits_update on public.expense_splits
  for update using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );
create policy splits_delete on public.expense_splits
  for delete using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and public.is_trip_member(e.trip_id, auth.uid())
    )
  );

-- trip_budgets
drop policy if exists budgets_select on public.trip_budgets;
drop policy if exists budgets_insert on public.trip_budgets;
drop policy if exists budgets_update on public.trip_budgets;
drop policy if exists budgets_delete on public.trip_budgets;

create policy budgets_select on public.trip_budgets
  for select using (public.is_trip_member(trip_id, auth.uid()));
create policy budgets_insert on public.trip_budgets
  for insert with check (public.is_trip_member(trip_id, auth.uid()));
create policy budgets_update on public.trip_budgets
  for update using (public.is_trip_member(trip_id, auth.uid()));
create policy budgets_delete on public.trip_budgets
  for delete using (public.is_trip_member(trip_id, auth.uid()));
