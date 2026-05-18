-- ============================================================
-- 003_triggers.sql — Triggers + SECURITY DEFINER RPCs
--
-- All functions use SET search_path = '' and fully-qualified
-- names to prevent search-path injection attacks.
-- ============================================================


-- ============================================================
-- updated_at trigger (shared by events and responses)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_responses_updated_at
  BEFORE UPDATE ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- Auto-create hosts row on auth.users INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.hosts (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- RPC: insert_response
-- Inserts a response + picks atomically for an anonymous guest.
-- Validates event is active and pick count is in range.
-- Returns { id, edit_token }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_response(
  p_event_id     uuid,
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
  v_event    public.events;
  v_token    text;
  v_resp_id  uuid;
  v_n_picks  int;
BEGIN
  -- Validate event: must be active, deadline not passed
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
    AND status = 'active'
    AND (response_deadline IS NULL OR response_deadline > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_closed'
      USING HINT = 'This event is not accepting responses';
  END IF;

  -- Validate pick count
  v_n_picks := coalesce(array_length(p_pick_ids, 1), 0);
  IF v_n_picks < 1 OR v_n_picks > v_event.max_picks_per_guest THEN
    RAISE EXCEPTION 'invalid_picks'
      USING HINT = 'Select between 1 and ' || v_event.max_picks_per_guest || ' items';
  END IF;

  -- Validate all menu_item_ids belong to this event
  IF EXISTS (
    SELECT 1 FROM unnest(p_pick_ids) AS pid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.menu_items mi
      WHERE mi.id = pid AND mi.event_id = p_event_id
    )
  ) THEN
    RAISE EXCEPTION 'invalid_item'
      USING HINT = 'One or more menu items do not belong to this event';
  END IF;

  -- Cryptographically random 16-char hex token
  v_token := encode(extensions.gen_random_bytes(8), 'hex');

  INSERT INTO public.responses (event_id, guest_name, guest_phone, notes, edit_token)
  VALUES (p_event_id, p_guest_name, p_guest_phone, p_notes, v_token)
  RETURNING id INTO v_resp_id;

  INSERT INTO public.response_picks (response_id, menu_item_id)
  SELECT v_resp_id, unnest(p_pick_ids);

  RETURN json_build_object('id', v_resp_id, 'edit_token', v_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.insert_response(uuid, text, text, text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.insert_response(uuid, text, text, text, uuid[]) TO anon;


-- ============================================================
-- RPC: get_response_by_token
-- Returns a response + its pick IDs for the guest edit form.
-- No auth required — token is the credential.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_response_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_resp  public.responses;
  v_picks uuid[];
BEGIN
  SELECT * INTO v_resp
  FROM public.responses
  WHERE edit_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'Invalid or expired edit token';
  END IF;

  SELECT array_agg(menu_item_id ORDER BY menu_item_id) INTO v_picks
  FROM public.response_picks
  WHERE response_id = v_resp.id;

  RETURN json_build_object(
    'id',           v_resp.id,
    'event_id',     v_resp.event_id,
    'guest_name',   v_resp.guest_name,
    'guest_phone',  v_resp.guest_phone,
    'notes',        v_resp.notes,
    'pick_ids',     COALESCE(v_picks, '{}'),
    'submitted_at', v_resp.submitted_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_response_by_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_response_by_token(text) TO anon;


-- ============================================================
-- RPC: update_response_by_token
-- Atomically replaces picks and updates guest info.
-- Validates event still active and pick count.
-- Returns { id, edit_token }.
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
  v_resp    public.responses;
  v_event   public.events;
  v_n_picks int;
BEGIN
  SELECT * INTO v_resp FROM public.responses WHERE edit_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found'
      USING HINT = 'Invalid or expired edit token';
  END IF;

  -- Check event is still active
  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_resp.event_id
    AND status = 'active'
    AND (response_deadline IS NULL OR response_deadline > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_closed'
      USING HINT = 'This event is no longer accepting responses';
  END IF;

  -- Validate pick count
  v_n_picks := coalesce(array_length(p_pick_ids, 1), 0);
  IF v_n_picks < 1 OR v_n_picks > v_event.max_picks_per_guest THEN
    RAISE EXCEPTION 'invalid_picks'
      USING HINT = 'Select between 1 and ' || v_event.max_picks_per_guest || ' items';
  END IF;

  -- Validate all menu_item_ids belong to this event
  IF EXISTS (
    SELECT 1 FROM unnest(p_pick_ids) AS pid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.menu_items mi
      WHERE mi.id = pid AND mi.event_id = v_event.id
    )
  ) THEN
    RAISE EXCEPTION 'invalid_item'
      USING HINT = 'One or more menu items do not belong to this event';
  END IF;

  UPDATE public.responses
  SET
    guest_name  = p_guest_name,
    guest_phone = p_guest_phone,
    notes       = p_notes,
    updated_at  = now()
  WHERE id = v_resp.id;

  -- Atomic picks replacement
  DELETE FROM public.response_picks WHERE response_id = v_resp.id;
  INSERT INTO public.response_picks (response_id, menu_item_id)
  SELECT v_resp.id, unnest(p_pick_ids);

  RETURN json_build_object('id', v_resp.id, 'edit_token', p_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_response_by_token(text, text, text, text, uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_response_by_token(text, text, text, text, uuid[]) TO anon;
