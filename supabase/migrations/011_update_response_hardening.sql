-- ============================================================
-- 011_update_response_hardening.sql
--
-- 1. Hardens update_response_by_token with granular validation
--    errors that mirror the checks added to insert_response in
--    migration 010. Signature and anon grant unchanged.
--
-- 2. Extends get_response_by_token to return pick_names plus
--    event metadata (slug, title, venue_name, event_datetime,
--    description, status). The edit page needs these to render
--    a read-only view when an event is closed or past-deadline:
--    anon RLS blocks menu_items reads for non-active events, so
--    this SECURITY DEFINER RPC is the only clean path without
--    widening RLS. Existing callers (thanks page) are unaffected
--    — they only destructure the fields they already used.
-- ============================================================


-- ============================================================
-- update_response_by_token — hardened
-- Signature unchanged: (text, text, text, text, uuid[]) → json
-- Grant unchanged: anon-callable
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_response_by_token(
  p_token        text,
  p_guest_name   text,
  p_guest_phone  text,
  p_notes        text,
  p_pick_ids     uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_resp        public.responses;
  v_event       public.events;
  v_n_picks     int;
  v_valid_count int;
BEGIN
  -- 1. Token must resolve to a real response.
  SELECT * INTO v_resp
  FROM public.responses
  WHERE edit_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'response_not_found'
      USING HINT = 'Invalid or expired edit token';
  END IF;

  -- 2. Event must still be active (separate check from deadline).
  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_resp.event_id;

  IF NOT FOUND OR v_event.status <> 'active' THEN
    RAISE EXCEPTION 'responses_closed'
      USING HINT = 'This event is no longer accepting responses';
  END IF;

  -- 3. Deadline must still be open.
  IF v_event.response_deadline IS NOT NULL
     AND v_event.response_deadline < now() THEN
    RAISE EXCEPTION 'responses_closed'
      USING HINT = 'The response deadline for this event has passed';
  END IF;

  -- 4. At least one pick required.
  v_n_picks := coalesce(array_length(p_pick_ids, 1), 0);
  IF v_n_picks = 0 THEN
    RAISE EXCEPTION 'no_picks'
      USING HINT = 'Select at least one menu item';
  END IF;

  -- 5. Too many picks.
  IF v_n_picks > v_event.max_picks_per_guest THEN
    RAISE EXCEPTION 'too_many_picks'
      USING HINT = 'Exceeded the maximum of ' || v_event.max_picks_per_guest || ' picks for this event';
  END IF;

  -- 6. All picks must belong to this event (cross-event pick prevention).
  SELECT count(*) INTO v_valid_count
  FROM public.menu_items
  WHERE id = ANY(p_pick_ids)
    AND event_id = v_event.id;

  IF v_valid_count <> v_n_picks THEN
    RAISE EXCEPTION 'invalid_menu_items'
      USING HINT = 'One or more selected items do not belong to this event';
  END IF;

  -- Apply update to guest fields.
  UPDATE public.responses
  SET
    guest_name  = p_guest_name,
    guest_phone = p_guest_phone,
    notes       = p_notes,
    updated_at  = now()
  WHERE id = v_resp.id;

  -- Atomic picks replacement: delete existing, insert new.
  DELETE FROM public.response_picks WHERE response_id = v_resp.id;
  INSERT INTO public.response_picks (response_id, menu_item_id)
  SELECT v_resp.id, unnest(p_pick_ids);

  RETURN json_build_object('id', v_resp.id, 'edit_token', p_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_response_by_token(text, text, text, text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_response_by_token(text, text, text, text, uuid[]) TO anon;


-- ============================================================
-- get_response_by_token — extended return fields
-- Signature unchanged: (text) → json
-- Grant unchanged: anon-callable
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_response_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_resp       public.responses;
  v_event      public.events;
  v_picks      uuid[];
  v_pick_names text[];
BEGIN
  SELECT * INTO v_resp
  FROM public.responses
  WHERE edit_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'Invalid or expired edit token';
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_resp.event_id;

  -- Aggregate pick UUIDs and names in the same ORDER BY so indices align.
  SELECT
    array_agg(rp.menu_item_id ORDER BY rp.menu_item_id),
    array_agg(mi.name          ORDER BY rp.menu_item_id)
  INTO v_picks, v_pick_names
  FROM public.response_picks rp
  JOIN public.menu_items mi ON mi.id = rp.menu_item_id
  WHERE rp.response_id = v_resp.id;

  RETURN json_build_object(
    -- Existing fields — callers depend on these, do not rename.
    'id',                v_resp.id,
    'event_id',          v_resp.event_id,
    'guest_name',        v_resp.guest_name,
    'guest_phone',       v_resp.guest_phone,
    'notes',             v_resp.notes,
    'pick_ids',          coalesce(v_picks,      '{}'),
    'submitted_at',      v_resp.submitted_at,
    -- New fields for the edit page.
    'pick_names',        coalesce(v_pick_names, '{}'),
    'event_slug',        v_event.slug,
    'event_title',       v_event.title,
    'event_venue_name',  v_event.venue_name,
    'event_datetime',    v_event.event_datetime,
    'event_description', v_event.description,
    'event_status',      v_event.status
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_response_by_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_response_by_token(text) TO anon;


-- ============================================================
-- Test queries (run manually in the Supabase SQL editor).
-- Replace placeholder values with real IDs from your database.
-- ============================================================
--
-- ─── update_response_by_token ────────────────────────────────
--
-- POSITIVE: valid token, active event, future deadline, valid pick
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>',
--   'Updated Name', null, 'No nuts',
--   ARRAY['<item_id_on_same_event>']::uuid[]
-- );
-- Expected: JSON { id: <uuid>, edit_token: <token> }
--
-- NEGATIVE: garbage token → response_not_found
-- SELECT public.update_response_by_token(
--   'notarealtoken00', 'Name', null, null,
--   ARRAY['<any_item_id>']::uuid[]
-- );
-- Expected: ERROR P0001: response_not_found
--
-- NEGATIVE: event closed by host after submission → responses_closed
-- (UPDATE public.events SET status = 'closed' WHERE id = '<event_id>')
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>', 'Name', null, null,
--   ARRAY['<item_id>']::uuid[]
-- );
-- Expected: ERROR P0001: responses_closed
--
-- NEGATIVE: deadline has passed → responses_closed
-- (UPDATE public.events SET response_deadline = now() - interval '1 hour' WHERE id = '<event_id>')
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>', 'Name', null, null,
--   ARRAY['<item_id>']::uuid[]
-- );
-- Expected: ERROR P0001: responses_closed
--
-- NEGATIVE: cross-event menu item → invalid_menu_items
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>', 'Name', null, null,
--   ARRAY['<item_id_from_different_event>']::uuid[]
-- );
-- Expected: ERROR P0001: invalid_menu_items
--
-- NEGATIVE: picks > max_picks_per_guest → too_many_picks
-- (Assuming max_picks_per_guest = 1, pass 2 IDs)
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>', 'Name', null, null,
--   ARRAY['<item_id_1>', '<item_id_2>']::uuid[]
-- );
-- Expected: ERROR P0001: too_many_picks
--
-- NEGATIVE: empty picks array → no_picks
-- SELECT public.update_response_by_token(
--   '<valid_edit_token>', 'Name', null, null,
--   ARRAY[]::uuid[]
-- );
-- Expected: ERROR P0001: no_picks
-- ============================================================
