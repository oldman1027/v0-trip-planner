-- RLS policies for Trip Planner

-- profiles: each user can read/write only their own profile
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);
create policy profiles_delete_own on public.profiles
  for delete using (auth.uid() = id);

-- Allow members to read other members' profiles for avatars/names
drop policy if exists profiles_select_co_members on public.profiles;
create policy profiles_select_co_members on public.profiles
  for select using (
    exists (
      select 1
      from public.trip_members tm_self
      join public.trip_members tm_other
        on tm_other.trip_id = tm_self.trip_id
      where tm_self.user_id = auth.uid()
        and tm_other.user_id = profiles.id
    )
  );

-- trips: members can select; creator/owner can update/delete; any auth user can insert (creator becomes owner via trigger)
drop policy if exists trips_select_members on public.trips;
drop policy if exists trips_insert_self on public.trips;
drop policy if exists trips_update_owner on public.trips;
drop policy if exists trips_delete_owner on public.trips;

create policy trips_select_members on public.trips
  for select using (
    public.is_trip_member(id, auth.uid())
  );

create policy trips_insert_self on public.trips
  for insert with check (auth.uid() = created_by);

create policy trips_update_owner on public.trips
  for update using (
    exists (
      select 1 from public.trip_members
      where trip_id = trips.id
        and user_id = auth.uid()
        and role in ('owner','editor')
    )
  );

create policy trips_delete_owner on public.trips
  for delete using (
    exists (
      select 1 from public.trip_members
      where trip_id = trips.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- trip_members: users can see rows for trips they're in, or their own membership rows
drop policy if exists trip_members_select on public.trip_members;
drop policy if exists trip_members_insert_self on public.trip_members;
drop policy if exists trip_members_insert_owner on public.trip_members;
drop policy if exists trip_members_update_owner on public.trip_members;
drop policy if exists trip_members_delete_self_or_owner on public.trip_members;

create policy trip_members_select on public.trip_members
  for select using (
    user_id = auth.uid() or public.is_trip_member(trip_id, auth.uid())
  );

-- A user can insert themselves as a member (used by the on-trip-create trigger via the owning user's row)
create policy trip_members_insert_self on public.trip_members
  for insert with check (user_id = auth.uid());

-- A trip owner can invite others
create policy trip_members_insert_owner on public.trip_members
  for insert with check (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

create policy trip_members_update_owner on public.trip_members
  for update using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

create policy trip_members_delete_self_or_owner on public.trip_members
  for delete using (
    user_id = auth.uid() or exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- activities: any trip member can read/write
drop policy if exists activities_select_members on public.activities;
drop policy if exists activities_insert_members on public.activities;
drop policy if exists activities_update_members on public.activities;
drop policy if exists activities_delete_members on public.activities;

create policy activities_select_members on public.activities
  for select using (public.is_trip_member(trip_id, auth.uid()));
create policy activities_insert_members on public.activities
  for insert with check (public.is_trip_member(trip_id, auth.uid()));
create policy activities_update_members on public.activities
  for update using (public.is_trip_member(trip_id, auth.uid()));
create policy activities_delete_members on public.activities
  for delete using (public.is_trip_member(trip_id, auth.uid()));

-- bookings: any trip member can read/write
drop policy if exists bookings_select_members on public.bookings;
drop policy if exists bookings_insert_members on public.bookings;
drop policy if exists bookings_update_members on public.bookings;
drop policy if exists bookings_delete_members on public.bookings;

create policy bookings_select_members on public.bookings
  for select using (public.is_trip_member(trip_id, auth.uid()));
create policy bookings_insert_members on public.bookings
  for insert with check (public.is_trip_member(trip_id, auth.uid()));
create policy bookings_update_members on public.bookings
  for update using (public.is_trip_member(trip_id, auth.uid()));
create policy bookings_delete_members on public.bookings
  for delete using (public.is_trip_member(trip_id, auth.uid()));
