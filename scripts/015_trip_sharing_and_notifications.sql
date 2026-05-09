-- 015_trip_sharing_and_notifications.sql
-- Extends trip_members with invite tracking, adds join-link and notification tables.

-- ─── 1. Extend trip_members ────────────────────────────────────────────────
ALTER TABLE public.trip_members
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. trip_share_links ───────────────────────────────────────────────────
-- One collaborative join-link per trip (distinct from the read-only share_token on trips).
CREATE TABLE IF NOT EXISTS public.trip_share_links (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id            UUID NOT NULL REFERENCES public.trips ON DELETE CASCADE,
  token              UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at       TIMESTAMPTZ,
  use_count          INT NOT NULL DEFAULT 0,
  CONSTRAINT trip_share_links_token_unique UNIQUE (token)
);

-- One active link per trip; upserting on trip_id regenerates the token.
CREATE UNIQUE INDEX IF NOT EXISTS trip_share_links_trip_idx
  ON public.trip_share_links (trip_id);

ALTER TABLE public.trip_share_links ENABLE ROW LEVEL SECURITY;

-- Any trip member may view the share link.
DROP POLICY IF EXISTS share_links_select ON public.trip_share_links;
CREATE POLICY share_links_select ON public.trip_share_links
  FOR SELECT USING (public.is_trip_member(trip_id, auth.uid()));

-- Only owners may create or regenerate a link.
DROP POLICY IF EXISTS share_links_insert ON public.trip_share_links;
CREATE POLICY share_links_insert ON public.trip_share_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = trip_share_links.trip_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS share_links_update ON public.trip_share_links;
CREATE POLICY share_links_update ON public.trip_share_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = trip_share_links.trip_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS share_links_delete ON public.trip_share_links;
CREATE POLICY share_links_delete ON public.trip_share_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_id = trip_share_links.trip_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ─── 3. notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata   JSONB
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON public.notifications (user_id, created_at DESC);

-- Partial index for fast unread counts.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- No INSERT policy — notifications are created server-side via service client only.

-- ─── 4. Email lookup helper ───────────────────────────────────────────────
-- Used by the invite-to-trip server action to find a user by email.
-- Returns NULL if no matching user exists.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id FROM auth.users WHERE email = lookup_email LIMIT 1;
  RETURN found_id;
END;
$$;

-- ─── 5. Activity tracking trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trip_members
  SET    last_activity_at = now()
  WHERE  trip_id = NEW.trip_id
    AND  user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_activity_change ON public.activities;
CREATE TRIGGER on_activity_change
  AFTER INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_member_last_activity();

DROP TRIGGER IF EXISTS on_booking_change ON public.bookings;
CREATE TRIGGER on_booking_change
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_member_last_activity();

DROP TRIGGER IF EXISTS on_expense_change ON public.expenses;
CREATE TRIGGER on_expense_change
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_member_last_activity();
