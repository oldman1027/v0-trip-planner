-- Trip version history: snapshot after every change, 30-day rolling window
CREATE TABLE IF NOT EXISTS trip_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  changed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name  text NOT NULL DEFAULT '',
  action           text NOT NULL CHECK (action IN ('added','edited','deleted','moved')),
  entity_type      text NOT NULL CHECK (entity_type IN ('activity','booking','trip')),
  entity_name      text NOT NULL DEFAULT '',
  snapshot         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_history_trip_idx ON trip_history (trip_id, created_at DESC);

ALTER TABLE trip_history ENABLE ROW LEVEL SECURITY;

-- Trip members can read history
CREATE POLICY "trip_history_select" ON trip_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_history.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Any authenticated member can insert (changed_by must be caller)
CREATE POLICY "trip_history_insert" ON trip_history
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = changed_by AND
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_history.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

-- Only trip owner can delete (used for pruning)
CREATE POLICY "trip_history_delete" ON trip_history
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trip_history.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.role = 'owner'
    )
    OR changed_by = auth.uid()
  );
