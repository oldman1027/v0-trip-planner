-- Add "activity" as a valid booking type and backfill activity.booking_id

-- Drop existing type check so we can widen it
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check;

-- New constraint includes "activity"
ALTER TABLE bookings
  ADD CONSTRAINT bookings_type_check
  CHECK (type IN ('hotel', 'flight', 'transport', 'other', 'restaurant', 'activity'));

-- Backfill booking_id on activities already linked via booking.details->>'activity_id'
UPDATE activities a
SET booking_id = b.id
FROM bookings b
WHERE b.details->>'activity_id' = a.id::text
  AND a.booking_id IS NULL;
