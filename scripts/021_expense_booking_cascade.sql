-- Change booking_id FK from SET NULL to CASCADE so deleting a booking removes its expense
alter table expenses drop constraint if exists expenses_booking_id_fkey;
alter table expenses
  add constraint expenses_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete cascade;

-- Clean up already-orphaned booking expenses (booking deleted, expense stayed behind)
delete from expenses
  where source_type = 'booking'
    and booking_id is null;
