-- ============================================================
-- 010_insert_response_hardening.sql
--
-- Hardens insert_response with granular validation errors and
-- separates the active-status check from the deadline check so
-- callers can distinguish the two failure modes.
--
-- Signature unchanged: (p_event_id uuid, p_guest_name text,
--   p_guest_phone text, p_notes text, p_pick_ids uuid[])
-- Grant unchanged: anon-callable.
-- Returns unchanged: json { id, edit_token }.
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_response(
  p_event_id    uuid,
  p_guest_name  text,
  p_guest_phone text,
  p_notes       text,
  p_pick_ids    uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_event       public.events;
  v_token       text;
  v_resp_id     uuid;
  v_n_picks     int;
  v_valid_count int;
BEGIN
  -- 1. Event must exist and be active.
  --    Same error whether the event doesn't exist or is draft/closed — no existence leak.
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_available'
      USING HINT = 'This event is not accepting responses';
  END IF;

  -- 2. Deadline enforcement (separate from active-status check).
  IF v_event.response_deadline IS NOT NULL AND v_event.response_deadline < now() THEN
    RAISE EXCEPTION 'responses_closed'
      USING HINT = 'The response deadline for this event has passed';
  END IF;

  -- 3. At least one pick required.
  v_n_picks := coalesce(array_length(p_pick_ids, 1), 0);
  IF v_n_picks = 0 THEN
    RAISE EXCEPTION 'no_picks'
      USING HINT = 'Select at least one menu item';
  END IF;

  -- 4. Too many picks.
  IF v_n_picks > v_event.max_picks_per_guest THEN
    RAISE EXCEPTION 'too_many_picks'
      USING HINT = 'Exceeded the maximum of ' || v_event.max_picks_per_guest || ' picks for this event';
  END IF;

  -- 5. All picks must belong to this event (cross-event pick prevention).
  SELECT count(*) INTO v_valid_count
  FROM public.menu_items
  WHERE id = ANY(p_pick_ids)
    AND event_id = p_event_id;

  IF v_valid_count <> v_n_picks THEN
    RAISE EXCEPTION 'invalid_menu_items'
      USING HINT = 'One or more selected items do not belong to this event';
  END IF;

  -- Cryptographically random 16-char hex edit token.
  v_token := encode(extensions.gen_random_bytes(8), 'hex');

  INSERT INTO public.responses (event_id, guest_name, guest_phone, notes, edit_token)
  VALUES (p_event_id, p_guest_name, p_guest_phone, p_notes, v_token)
  RETURNING id INTO v_resp_id;

  INSERT INTO public.response_picks (response_id, menu_item_id)
  SELECT v_resp_id, unnest(p_pick_ids);

  RETURN json_build_object('id', v_resp_id, 'edit_token', v_token);
END;
$$;

-- Grant unchanged: anon-callable (matching 003_triggers.sql convention).
REVOKE EXECUTE ON FUNCTION public.insert_response(uuid, text, text, text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.insert_response(uuid, text, text, text, uuid[]) TO anon;


-- ============================================================
-- Test queries (run manually via Supabase SQL editor or MCP)
--
-- Prerequisites:
--   - An active event: replace <active_event_id> and <item_id_1>/<item_id_2>
--     with real values from your database.
--   - A draft event: replace <draft_event_id>.
--   - A menu item from a DIFFERENT event: replace <other_event_item_id>.
--
-- ── POSITIVE: happy path ──────────────────────────────────────
--
-- SELECT public.insert_response(
--   '<active_event_id>'::uuid,
--   'Test Guest',
--   '+977 9812345678',
--   'No nuts please',
--   ARRAY['<item_id_1>']::uuid[]
-- );
-- -- Expected: JSON { id: <uuid>, edit_token: <16-char hex> }
--
-- ── NEGATIVE: past deadline → responses_closed ────────────────
-- (Manually set response_deadline to now() - interval '1 hour' on the event,
--  then:)
-- SELECT public.insert_response(
--   '<active_event_id>'::uuid, 'Guest', null, null,
--   ARRAY['<item_id_1>']::uuid[]
-- );
-- -- Expected: ERROR P0001: responses_closed
--
-- ── NEGATIVE: draft event → event_not_available ───────────────
-- SELECT public.insert_response(
--   '<draft_event_id>'::uuid, 'Guest', null, null,
--   ARRAY['<item_id_1>']::uuid[]
-- );
-- -- Expected: ERROR P0001: event_not_available
--
-- ── NEGATIVE: cross-event pick → invalid_menu_items ──────────
-- SELECT public.insert_response(
--   '<active_event_id>'::uuid, 'Guest', null, null,
--   ARRAY['<other_event_item_id>']::uuid[]
-- );
-- -- Expected: ERROR P0001: invalid_menu_items
--
-- ── NEGATIVE: picks > max_picks_per_guest → too_many_picks ───
-- (Assuming max_picks_per_guest = 2, pass 3 item IDs:)
-- SELECT public.insert_response(
--   '<active_event_id>'::uuid, 'Guest', null, null,
--   ARRAY['<item_id_1>', '<item_id_2>', '<item_id_1>']::uuid[]
-- );
-- -- Expected: ERROR P0001: too_many_picks
-- ============================================================
