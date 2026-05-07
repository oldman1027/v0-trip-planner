-- Add new columns to bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_number TEXT,
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS check_in_time TIME,
  ADD COLUMN IF NOT EXISTS check_out_time TIME,
  ADD COLUMN IF NOT EXISTS departure_time TIME,
  ADD COLUMN IF NOT EXISTS arrival_time TIME;

-- Drop old type constraint before migrating data
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_type_check;

-- Migrate flight → transport, tag subtype in details
UPDATE public.bookings
SET
  type    = 'transport',
  details = COALESCE(details, '{}'::jsonb) || '{"transport_type":"flight"}'::jsonb
WHERE type = 'flight';

-- Tag existing ground transport bookings (avoid overwriting existing transport_type)
UPDATE public.bookings
SET details = COALESCE(details, '{}'::jsonb) || '{"transport_type":"bus"}'::jsonb
WHERE type = 'transport'
  AND (details ->>'transport_type') IS NULL;

-- hotel → accommodation
UPDATE public.bookings SET type = 'accommodation' WHERE type = 'hotel';

-- restaurant → dining
UPDATE public.bookings SET type = 'dining' WHERE type = 'restaurant';

-- experience → activities
UPDATE public.bookings SET type = 'activities' WHERE type = 'experience';

-- Add updated constraint
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_type_check
  CHECK (type IN ('accommodation','transport','dining','activities','other'));
