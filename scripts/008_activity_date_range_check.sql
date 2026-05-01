-- Reject activity inserts/updates where day_date falls outside the parent trip's date range.

CREATE OR REPLACE FUNCTION check_activity_date_in_trip_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_start date;
  trip_end   date;
BEGIN
  -- Unscheduled activities (wishlist / no day assigned) are always allowed.
  IF NEW.day_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT start_date, end_date
    INTO trip_start, trip_end
    FROM trips
   WHERE id = NEW.trip_id;

  IF NEW.day_date < trip_start OR NEW.day_date > trip_end THEN
    RAISE EXCEPTION 'Invalid activity date: outside trip range (%, % – %)',
      NEW.day_date, trip_start, trip_end;
  END IF;

  RETURN NEW;
END;
$$;

-- Only re-validate when the date or trip association actually changes.
DROP TRIGGER IF EXISTS activity_date_range_check ON activities;
CREATE TRIGGER activity_date_range_check
  BEFORE INSERT OR UPDATE OF day_date, trip_id ON activities
  FOR EACH ROW EXECUTE FUNCTION check_activity_date_in_trip_range();
