-- Security definer helper that returns true if the given user is a member of
-- the given trip. Used by RLS policies to avoid recursive policy evaluation
-- against trip_members.

create or replace function public.is_trip_member(_trip_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = _trip_id
      and user_id = _user_id
  );
$$;

grant execute on function public.is_trip_member(uuid, uuid) to authenticated, anon;
