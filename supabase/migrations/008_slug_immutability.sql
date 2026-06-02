-- Slugs are permanent public URLs generated at event-creation time.
-- Changing a slug after creation would silently break any shared links.
-- This trigger enforces immutability at the database level as defense-in-depth
-- alongside the application-layer constraint.
CREATE OR REPLACE FUNCTION public.prevent_slug_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    -- ERRCODE 23514 = check_violation; semantically correct for a constraint-like guard.
    RAISE EXCEPTION 'slug is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Fires BEFORE every UPDATE on events so the exception stops the statement
-- before any row change is written.
CREATE OR REPLACE TRIGGER events_slug_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_slug_update();
