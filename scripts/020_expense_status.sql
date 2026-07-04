-- Add status column to expenses
alter table expenses
  add column if not exists status text
    not null default 'estimated'
    check (status in ('paid', 'estimated', 'pending'));

-- Backfill based on source type
update expenses set status = 'paid'      where source_type = 'booking';
update expenses set status = 'estimated' where source_type = 'itinerary';
update expenses set status = 'estimated' where source_type = 'manual';
