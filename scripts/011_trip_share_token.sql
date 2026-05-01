-- Add public sharing support to trips

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_public   BOOLEAN NOT NULL DEFAULT false;

-- Ensure every existing trip has a unique token (backfill)
UPDATE trips SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS trips_share_token_idx ON trips (share_token);

-- Allow anonymous users to read public trips via their token
CREATE POLICY "Public trips readable by share token"
  ON trips
  FOR SELECT
  TO anon
  USING (is_public = true);
