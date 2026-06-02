-- FK note: response_picks.menu_item_id → menu_items.id is ON DELETE CASCADE.
-- update_event_full deletes all menu_items for an event before re-inserting them.
-- The response-count = 0 guard means no response_picks can reference those items,
-- so the cascade never fires in practice. The guard is the safety net; the cascade
-- is benign here (no RESTRICT to trip us, no data loss because count = 0).

-- ---------------------------------------------------------------------------
-- update_event_metadata
-- Updates the six metadata columns on an event owned by the caller.
-- Allowed on draft and active events only. Does NOT touch slug, status,
-- max_picks_per_guest, or menu items.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_event_metadata(
  p_event_id          uuid,
  p_title             text,
  p_venue             text,
  p_datetime          timestamptz,
  p_description       text,
  p_response_deadline timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT e.status INTO v_status
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.host_id = auth.uid();

  IF NOT FOUND THEN
    -- Same error for missing and cross-host events: no existence leak.
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'cannot_edit_closed_event';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF p_response_deadline IS NOT NULL AND p_datetime IS NOT NULL THEN
    IF p_response_deadline >= p_datetime THEN
      RAISE EXCEPTION 'deadline_after_event';
    END IF;
  END IF;

  UPDATE public.events
  SET
    title             = btrim(p_title),
    venue_name        = NULLIF(btrim(COALESCE(p_venue, '')), ''),
    event_datetime    = p_datetime,
    description       = NULLIF(btrim(COALESCE(p_description, '')), ''),
    response_deadline = p_response_deadline,
    updated_at        = now()
  WHERE id = p_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_event_metadata(uuid, text, text, timestamptz, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_event_metadata(uuid, text, text, timestamptz, text, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_event_metadata(uuid, text, text, timestamptz, text, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_event_full
-- Updates all editable event fields AND replaces the menu item list atomically.
-- Only allowed when the event has zero responses. If any response exists, the
-- caller should use update_event_metadata instead (menu items are then frozen).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_event_full(
  p_event_id            uuid,
  p_title               text,
  p_venue               text,
  p_datetime            timestamptz,
  p_description         text,
  p_response_deadline   timestamptz,
  p_max_picks_per_guest int,
  p_menu_items          jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status         text;
  v_response_count bigint;
  v_item           jsonb;
  v_idx            int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT e.status INTO v_status
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.host_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'cannot_edit_closed_event';
  END IF;

  SELECT count(*) INTO v_response_count
  FROM public.responses
  WHERE event_id = p_event_id;

  IF v_response_count > 0 THEN
    RAISE EXCEPTION 'event has responses; use metadata update';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF p_max_picks_per_guest IS NULL OR p_max_picks_per_guest < 1 OR p_max_picks_per_guest > 10 THEN
    RAISE EXCEPTION 'invalid_max_picks';
  END IF;

  IF p_response_deadline IS NOT NULL AND p_datetime IS NOT NULL THEN
    IF p_response_deadline >= p_datetime THEN
      RAISE EXCEPTION 'deadline_after_event';
    END IF;
  END IF;

  IF p_menu_items IS NULL OR jsonb_array_length(p_menu_items) = 0 THEN
    RAISE EXCEPTION 'no_menu_items';
  END IF;

  -- Validate all item names before any mutation so we fail atomically.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_menu_items)
  LOOP
    IF v_item->>'name' IS NULL OR length(btrim(v_item->>'name')) = 0 THEN
      RAISE EXCEPTION 'menu_item_name_required';
    END IF;
  END LOOP;

  UPDATE public.events
  SET
    title                = btrim(p_title),
    venue_name           = NULLIF(btrim(COALESCE(p_venue, '')), ''),
    event_datetime       = p_datetime,
    description          = NULLIF(btrim(COALESCE(p_description, '')), ''),
    response_deadline    = p_response_deadline,
    max_picks_per_guest  = p_max_picks_per_guest,
    updated_at           = now()
  WHERE id = p_event_id;

  -- Replace menu items atomically. Because v_response_count = 0, there are no
  -- response_picks referencing these items, so the ON DELETE CASCADE on
  -- response_picks.menu_item_id is harmless.
  DELETE FROM public.menu_items WHERE event_id = p_event_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_menu_items)
  LOOP
    INSERT INTO public.menu_items (event_id, name, description, category, sort_order)
    VALUES (
      p_event_id,
      btrim(v_item->>'name'),
      NULLIF(btrim(COALESCE(v_item->>'description', '')), ''),
      NULLIF(btrim(COALESCE(v_item->>'category', '')), ''),
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_event_full(uuid, text, text, timestamptz, text, timestamptz, int, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_event_full(uuid, text, text, timestamptz, text, timestamptz, int, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_event_full(uuid, text, text, timestamptz, text, timestamptz, int, jsonb) TO authenticated;
