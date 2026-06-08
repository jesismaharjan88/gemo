-- ============================================================
-- 014_rate_limiting.sql
--
-- Adds per-IP and per-event sliding-window rate limiting to
-- insert_response (the guest submission RPC).
--
-- 1. Creates response_submission_log — RLS-enabled, no direct
--    access from anon or authenticated; only the SECURITY
--    DEFINER RPC (running as owner) can write to it.
--
-- 2. Drops the old 5-parameter insert_response.
--    Leaving it would create a bypassable backdoor: any caller
--    could invoke the old signature (without p_ip) and skip the
--    rate gate entirely.
--
-- 3. Creates a new 6-parameter insert_response(... p_ip text)
--    with two limits added BEFORE the existing validation:
--      a. 30 submissions / minute / IP   (per brief spec)
--      b. 60 submissions / minute / event (IP-spoof-immune:
--         event_id is validated by the RPC's own event lookup)
--
-- Residual risk (accepted for v1): because insert_response is
-- anon-callable by design, a script that hits the Supabase Data
-- API directly can supply any value for p_ip and evade the
-- per-IP limit. The per-event cap (b) is immune to this since
-- event_id is server-validated and cannot be forged by the
-- caller. See M8-rate-limit.md for full risk statement.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Submission log table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.response_submission_log (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         text        NOT NULL,
  event_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rsl_ip_created_at_idx
  ON public.response_submission_log (ip, created_at);
CREATE INDEX IF NOT EXISTS rsl_event_id_created_at_idx
  ON public.response_submission_log (event_id, created_at);

-- RLS enabled, default-deny: no SELECT/INSERT/UPDATE/DELETE
-- for any role. Only the SECURITY DEFINER function (owner) writes.
ALTER TABLE public.response_submission_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.response_submission_log FROM PUBLIC;
REVOKE ALL ON TABLE public.response_submission_log FROM anon;
REVOKE ALL ON TABLE public.response_submission_log FROM authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. Drop old 5-parameter insert_response
--    (old anon grant disappears with the function)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.insert_response(uuid, text, text, text, uuid[]);


-- ─────────────────────────────────────────────────────────────
-- 3. New 6-parameter insert_response with rate limiting
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_response(
  p_event_id    uuid,
  p_guest_name  text,
  p_guest_phone text,
  p_notes       text,
  p_pick_ids    uuid[],
  p_ip          text   -- required; no default prevents silent bypass
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  -- ── Rate-limit thresholds ─────────────────────────────────────────────────
  -- To test: temporarily set c_ip_limit_per_min to a small value (e.g. 3),
  -- verify the 4th submission in < 60 s is rejected, then restore to 30.
  c_ip_limit_per_min    constant int := 30;   -- submissions / minute / IP
  c_event_limit_per_min constant int := 60;   -- submissions / minute / event

  v_ip_count    int;
  v_event_count int;
  v_event       public.events;
  v_token       text;
  v_resp_id     uuid;
  v_n_picks     int;
  v_valid_count int;
BEGIN

  -- ── 0a. Per-IP sliding-window check ──────────────────────────────────────
  -- Skipped when p_ip = 'unknown' (fail-open: real guest, missing header).
  -- The per-event cap below still protects the database in that case.
  IF p_ip IS DISTINCT FROM 'unknown' THEN
    SELECT count(*) INTO v_ip_count
    FROM public.response_submission_log
    WHERE ip         = p_ip
      AND created_at > now() - interval '1 minute';

    IF v_ip_count >= c_ip_limit_per_min THEN
      RAISE EXCEPTION 'rate_limit_exceeded'
        USING HINT = 'Too many submissions from your address. Please wait a minute and try again.';
    END IF;
  END IF;

  -- ── 0b. Per-event sliding-window check (IP-spoof-immune) ─────────────────
  -- event_id is validated by the RPC's own event lookup, so a caller cannot
  -- forge their way around this by rotating the IP value.
  SELECT count(*) INTO v_event_count
  FROM public.response_submission_log
  WHERE event_id   = p_event_id
    AND created_at > now() - interval '1 minute';

  IF v_event_count >= c_event_limit_per_min THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING HINT = 'This event is receiving too many submissions right now. Please try again shortly.';
  END IF;

  -- ── 0c. Log this submission (inside the transaction) ─────────────────────
  -- Rolls back if the validation below fails, so only successful submissions
  -- count toward future rate checks.
  INSERT INTO public.response_submission_log (ip, event_id)
  VALUES (p_ip, p_event_id);

  -- ── 0d. Opportunistic pruning (keeps the table small at v1 scale) ─────────
  DELETE FROM public.response_submission_log
  WHERE created_at < now() - interval '1 hour';

  -- ── 1. Event must exist and be active ────────────────────────────────────
  SELECT * INTO v_event
  FROM public.events
  WHERE id     = p_event_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_available'
      USING HINT = 'This event is not accepting responses';
  END IF;

  -- ── 2. Deadline enforcement ───────────────────────────────────────────────
  IF v_event.response_deadline IS NOT NULL AND v_event.response_deadline < now() THEN
    RAISE EXCEPTION 'responses_closed'
      USING HINT = 'The response deadline for this event has passed';
  END IF;

  -- ── 3. At least one pick required ────────────────────────────────────────
  v_n_picks := coalesce(array_length(p_pick_ids, 1), 0);
  IF v_n_picks = 0 THEN
    RAISE EXCEPTION 'no_picks'
      USING HINT = 'Select at least one menu item';
  END IF;

  -- ── 4. Too many picks ────────────────────────────────────────────────────
  IF v_n_picks > v_event.max_picks_per_guest THEN
    RAISE EXCEPTION 'too_many_picks'
      USING HINT = 'Exceeded the maximum of ' || v_event.max_picks_per_guest || ' picks for this event';
  END IF;

  -- ── 5. All picks must belong to this event ───────────────────────────────
  SELECT count(*) INTO v_valid_count
  FROM public.menu_items
  WHERE id       = ANY(p_pick_ids)
    AND event_id = p_event_id;

  IF v_valid_count <> v_n_picks THEN
    RAISE EXCEPTION 'invalid_menu_items'
      USING HINT = 'One or more selected items do not belong to this event';
  END IF;

  -- ── Insert response ───────────────────────────────────────────────────────
  v_token := encode(extensions.gen_random_bytes(8), 'hex');

  INSERT INTO public.responses (event_id, guest_name, guest_phone, notes, edit_token)
  VALUES (p_event_id, p_guest_name, p_guest_phone, p_notes, v_token)
  RETURNING id INTO v_resp_id;

  INSERT INTO public.response_picks (response_id, menu_item_id)
  SELECT v_resp_id, unnest(p_pick_ids);

  RETURN json_build_object('id', v_resp_id, 'edit_token', v_token);
END;
$$;

-- Self-grant tail — single source of truth for the anon grant.
-- REVOKE ALL (not just REVOKE EXECUTE) so re-applying this migration is safe:
-- it clears any stale grants before re-asserting the one we want.
REVOKE ALL ON FUNCTION public.insert_response(uuid, text, text, text, uuid[], text) FROM public;
GRANT  EXECUTE ON FUNCTION public.insert_response(uuid, text, text, text, uuid[], text) TO anon;


-- ============================================================
-- Manual test notes (run via Supabase SQL editor)
--
-- To test the rate limit interactively:
--   1. In the RPC body, temporarily set c_ip_limit_per_min := 3.
--   2. Submit 3 times with p_ip = '1.2.3.4'.
--   3. 4th attempt → ERROR: rate_limit_exceeded
--   4. Wait 60 s → next attempt succeeds again.
--   5. Restore c_ip_limit_per_min := 30.
--
-- For the per-event cap (c_event_limit_per_min), set it to 3 and
-- submit from 3 different p_ip values on the same event; the 4th
-- is rejected regardless of IP.
-- ============================================================
