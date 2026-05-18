-- ============================================================
-- 005_onboarding.sql — Onboarding state + host/event RPCs
--
-- Adds onboarded_at to hosts. An explicit timestamp is clearer
-- than inferring from full_name vs email comparison — and lets
-- us add further onboarding steps later without schema gymnastics.
--
-- New RPCs follow the same SECURITY DEFINER + SET search_path
-- pattern as 003_triggers.sql.
--
-- DEFERRED (tracked here so they aren't lost):
--   TODO (milestone 5): Add slug-immutability BEFORE UPDATE trigger
--     on events so future code paths can't overwrite slugs and break
--     shared guest links. Alongside rate limiting work.
--   TODO (milestone 6): Extend set_event_status allowed transitions
--     to include 'archived' once the "all past events" view is built.
-- ============================================================


-- ============================================================
-- Schema: onboarding flag
-- ============================================================
ALTER TABLE public.hosts ADD COLUMN onboarded_at timestamptz;


-- ============================================================
-- RPC: update_host_profile
-- Authenticated host updates their own name and marks onboarded.
-- Using a SECURITY DEFINER RPC instead of an open UPDATE policy
-- keeps the pattern consistent with the response RPCs and means
-- we never need to widen the hosts UPDATE policy.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_host_profile(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated'
      USING HINT = 'Must be logged in to update profile';
  END IF;

  -- Input validation (defense-in-depth; Zod catches first on the form)
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name'
      USING HINT = 'Name cannot be empty';
  END IF;
  IF length(btrim(p_name)) > 100 THEN
    RAISE EXCEPTION 'invalid_name'
      USING HINT = 'Name must be 100 characters or fewer';
  END IF;

  UPDATE public.hosts
  SET
    name         = btrim(p_name),
    onboarded_at = COALESCE(onboarded_at, now())
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'No host row for current user';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_host_profile(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_host_profile(text) TO authenticated;


-- ============================================================
-- RPC: set_event_status
-- Authenticated host changes status of their own event.
-- Validates ownership inside the function — RLS on events already
-- blocks cross-host SELECTs, but an explicit ownership check here
-- is defense-in-depth and gives a clear error vs. silent 0 rows.
--
-- Allowed transitions:
--   draft   -> active   (publish)
--   draft   -> closed   (discard without publishing)
--   active  -> closed   (close event)
--   closed  -> active   (reopen)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_event_status(
  p_event_id uuid,
  p_status   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated'
      USING HINT = 'Must be logged in to change event status';
  END IF;

  IF p_status NOT IN ('draft', 'active', 'closed') THEN
    RAISE EXCEPTION 'invalid_status'
      USING HINT = 'Status must be draft, active, or closed';
  END IF;

  SELECT status INTO v_current_status
  FROM public.events
  WHERE id = p_event_id AND host_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'Event not found';
  END IF;

  IF NOT (
    (v_current_status = 'draft'  AND p_status IN ('active', 'closed')) OR
    (v_current_status = 'active' AND p_status = 'closed') OR
    (v_current_status = 'closed' AND p_status = 'active')
  ) THEN
    RAISE EXCEPTION 'invalid_transition'
      USING HINT = 'Cannot transition from ' || v_current_status || ' to ' || p_status;
  END IF;

  UPDATE public.events
  SET status = p_status
  WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_event_status(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_event_status(uuid, text) TO authenticated;
