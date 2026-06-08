-- KIV (Keep In View) tray
-- Activities can be flagged is_kiv=true to appear in the tray instead of the board
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_kiv boolean NOT NULL DEFAULT false;

-- Freeform notes attached to a trip's KIV tray
CREATE TABLE IF NOT EXISTS kiv_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  content      text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kiv_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kiv_notes_select" ON kiv_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = kiv_notes.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "kiv_notes_insert" ON kiv_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = kiv_notes.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "kiv_notes_update" ON kiv_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "kiv_notes_delete" ON kiv_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);
