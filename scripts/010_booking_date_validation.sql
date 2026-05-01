-- Add booking_date column and enforce it stays within the parent trip's date range.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date date;

-- Backfill restaurant bookings from the stored datetime
UPDATE bookings
SET booking_date = (details->>'datetime')::date
WHERE type = 'restaurant'
  AND details->>'datetime' IS NOT NULL
  AND booking_date IS NULL;

-- Backfill activity-linked bookings from the linked activity's day_date
UPDATE bookings b
SET booking_date = a.day_date
FROM activities a
WHERE b.details->>'activity_id' = a.id::text
  AND b.booking_date IS NULL;

-- ── Trigger ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_booking_date_in_trip_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_start date;
  trip_end   date;
  linked_day date;
BEGIN
  -- Linked booking: auto-correct booking_date to match the activity's day_date
  -- (user cannot set it independently — it always follows the activity).
  IF NEW.details->>'activity_id' IS NOT NULL THEN
    SELECT day_date INTO linked_day
    FROM activities
    WHERE id = (NEW.details->>'activity_id')::uuid;

    IF linked_day IS NOT NULL THEN
      NEW.booking_date := linked_day;
    END IF;
  END IF;

  -- No date to validate → allow.
  IF NEW.booking_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT start_date, end_date INTO trip_start, trip_end
  FROM trips WHERE id = NEW.trip_id;

  IF NEW.booking_date < trip_start OR NEW.booking_date > trip_end THEN
    RAISE EXCEPTION 'Invalid booking date: outside trip range (%, % – %)',
      NEW.booking_date, trip_start, trip_end;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on the columns that carry date information.
DROP TRIGGER IF EXISTS booking_date_range_check ON bookings;
CREATE TRIGGER booking_date_range_check
  BEFORE INSERT OR UPDATE OF booking_date, details, trip_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_date_in_trip_range();
