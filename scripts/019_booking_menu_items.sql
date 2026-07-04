create table if not exists booking_menu_items (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade not null,
  item_name text not null default '',
  qty integer not null default 1,
  unit_price numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create index if not exists booking_menu_items_booking_id_idx on booking_menu_items(booking_id);

-- RLS
alter table booking_menu_items enable row level security;

-- Members of the trip can read/write menu items for their bookings
create policy "Trip members can manage menu items"
  on booking_menu_items
  for all
  using (
    exists (
      select 1 from bookings b
      join trip_members tm on tm.trip_id = b.trip_id
      where b.id = booking_menu_items.booking_id
        and tm.user_id = auth.uid()
    )
  );
