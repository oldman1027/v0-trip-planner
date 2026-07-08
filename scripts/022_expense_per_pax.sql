alter table expenses
  add column if not exists is_per_pax boolean not null default false,
  add column if not exists pax_count integer;

-- Backfill: every existing row is a group total — do NOT guess which are per-pax.
update expenses set is_per_pax = false where is_per_pax is null;
