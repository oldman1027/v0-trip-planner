-- Rename booking type "activity" → "experience"

-- Widen constraint to allow both during migration, then replace
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_type_check;

UPDATE bookings SET type = 'experience' WHERE type = 'activity';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_type_check
  CHECK (type IN ('hotel', 'flight', 'transport', 'other', 'restaurant', 'experience'));
