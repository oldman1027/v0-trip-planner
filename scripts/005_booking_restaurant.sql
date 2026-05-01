-- Expand bookings.type to include 'restaurant'
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.bookings'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%hotel%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_type_check
  CHECK (type IN ('hotel','flight','transport','other','restaurant'));

-- Expand bookings.payment_status to include 'confirmed' and 'cancelled'
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.bookings'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%payment_status%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('pending','paid','partial','confirmed','cancelled'));
