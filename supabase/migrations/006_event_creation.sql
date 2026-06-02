-- ============================================================
-- 006_event_creation.sql — Atomic event + menu creation RPC
--
-- Follows the same SECURITY DEFINER + SET search_path = ''
-- conventions as 003_triggers.sql and 005_onboarding.sql.
-- ============================================================


-- ============================================================
-- Ensure the slug unique index exists (idempotent).
-- The UNIQUE constraint in 001_init.sql already created this
-- index implicitly; IF NOT EXISTS makes this a safe no-op.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON public.events (slug);


-- ============================================================
-- RPC: create_event_with_items
--
-- Atomically inserts an event and its menu items in one call.
-- Called by the host event-creation form on final submission.
--
-- p_venue maps to events.venue_name.
-- p_menu_items is a jsonb array of objects with keys:
--   name        text  (required)
--   description text  (optional)
--   category    text  (optional)
-- sort_order for each item is assigned from the array index
-- (0-based) and any sort_order field in the JSON is ignored.
--
-- Returns one row: (event_id uuid, slug text).
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_event_with_items(
  p_title               text,
  p_slug                text,
  p_venue               text,
  p_event_datetime      timestamptz,
  p_description         text,
  p_max_picks_per_guest int,
  p_response_deadline   timestamptz,
  p_status              text,
  p_menu_items          jsonb
)
RETURNS TABLE (event_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_host_id   uuid;
  v_event_id  uuid;
  v_item      jsonb;
  v_counter   int := 0;
  v_item_name text;
BEGIN
  -- ── Auth ────────────────────────────────────────────────────
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hosts WHERE id = v_host_id) THEN
    RAISE EXCEPTION 'host_not_found';
  END IF;

  -- ── Input validation (order is intentional — spec-mandated) ─
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'title_required';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF p_max_picks_per_guest IS NULL
     OR p_max_picks_per_guest < 1
     OR p_max_picks_per_guest > 10 THEN
    RAISE EXCEPTION 'invalid_max_picks';
  END IF;

  IF p_event_datetime IS NULL OR p_event_datetime <= now() THEN
    RAISE EXCEPTION 'event_in_past';
  END IF;

  IF p_response_deadline IS NULL OR p_response_deadline >= p_event_datetime THEN
    RAISE EXCEPTION 'deadline_after_event';
  END IF;

  IF p_menu_items IS NULL
     OR jsonb_typeof(p_menu_items) <> 'array'
     OR jsonb_array_length(p_menu_items) = 0 THEN
    RAISE EXCEPTION 'no_menu_items';
  END IF;

  -- ── Insert event ─────────────────────────────────────────────
  INSERT INTO public.events (
    host_id,
    slug,
    title,
    venue_name,
    event_datetime,
    description,
    max_picks_per_guest,
    response_deadline,
    status
  )
  VALUES (
    v_host_id,
    p_slug,
    btrim(p_title),
    nullif(btrim(coalesce(p_venue, '')), ''),
    p_event_datetime,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_max_picks_per_guest,
    p_response_deadline,
    p_status
  )
  RETURNING id INTO v_event_id;

  -- ── Insert menu items (sort_order = array index, 0-based) ───
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_menu_items)
  LOOP
    v_item_name := v_item->>'name';
    IF v_item_name IS NULL OR length(btrim(v_item_name)) = 0 THEN
      RAISE EXCEPTION 'menu_item_name_required';
    END IF;

    INSERT INTO public.menu_items (
      event_id,
      name,
      description,
      category,
      sort_order
    )
    VALUES (
      v_event_id,
      btrim(v_item_name),
      nullif(btrim(coalesce(v_item->>'description', '')), ''),
      nullif(btrim(coalesce(v_item->>'category', '')), ''),
      v_counter
    );

    v_counter := v_counter + 1;
  END LOOP;

  -- ── Return ───────────────────────────────────────────────────
  RETURN QUERY SELECT v_event_id, p_slug;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_event_with_items(
  text, text, text, timestamptz, text, int, timestamptz, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_event_with_items(
  text, text, text, timestamptz, text, int, timestamptz, text, jsonb
) TO authenticated;


-- ============================================================
-- Test queries (run manually after applying migration)
-- ============================================================
--
-- Prerequisites: a real auth.users row + matching hosts row.
-- Replace <host_uid> with an actual uid from auth.users.
-- All queries assume you SET role to the host's JWT context
-- or use a service-role client to impersonate.
--
-- ── POSITIVE: happy path — 3 items, verify sort_order ────────
--
-- SELECT * FROM public.create_event_with_items(
--   'Jes Birthday Lunch',
--   'jes-birthday-lunch-x4k2',
--   'The Venue',
--   now() + interval '7 days',
--   'Lunch is on me.',
--   3,
--   now() + interval '5 days',
--   'active',
--   '[
--     {"name": "Butter Chicken", "category": "Mains"},
--     {"name": "Garlic Naan",   "category": "Sides"},
--     {"name": "Gulab Jamun",   "category": "Desserts"}
--   ]'::jsonb
-- );
--
-- Verify sort_order matches insertion order:
-- SELECT name, sort_order
-- FROM public.menu_items
-- WHERE event_id = '<returned event_id>'
-- ORDER BY sort_order;
-- -- Expected: Butter Chicken=0, Garlic Naan=1, Gulab Jamun=2
--
-- ── NEGATIVE: title_required ──────────────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   '   ',        -- whitespace-only → title_required
--   'slug-x',
--   'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '5 days',
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: title_required
--
-- ── NEGATIVE: invalid_status ─────────────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '5 days',
--   'closed',     -- only draft/active allowed
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: invalid_status
--
-- ── NEGATIVE: invalid_max_picks ──────────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 11,     -- exceeds CHECK constraint max of 10
--   now() + interval '5 days',
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: invalid_max_picks
--
-- ── NEGATIVE: event_in_past ───────────────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() - interval '1 hour',    -- in the past
--   null, 3, null,
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: event_in_past
--
-- ── NEGATIVE: deadline_after_event ───────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '8 days',   -- deadline AFTER event datetime
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: deadline_after_event
--
-- Also test NULL deadline:
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   null,                         -- NULL deadline → deadline_after_event
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: deadline_after_event
--
-- ── NEGATIVE: no_menu_items ───────────────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '5 days',
--   'active',
--   '[]'::jsonb   -- empty array → no_menu_items
-- );
-- -- Expected error: no_menu_items
--
-- ── NEGATIVE: menu_item_name_required ─────────────────────────
--
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '5 days',
--   'active',
--   '[{"name": "   "}]'::jsonb   -- whitespace-only name
-- );
-- -- Expected error: menu_item_name_required
--
-- ── NEGATIVE: anon permission check ──────────────────────────
--
-- NOTE: Supabase's PostgREST allows anon to invoke public-schema
-- functions regardless of REVOKE from PUBLIC. The effective security
-- gate is the auth.uid() IS NULL check inside the function.
-- Verified empirically: update_host_profile behaves identically.
--
-- Connect as anon role (or use publishable/anon key client):
-- SELECT * FROM public.create_event_with_items(
--   'My Event', 'slug-x', 'Venue',
--   now() + interval '7 days',
--   null, 3,
--   now() + interval '5 days',
--   'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected error: not_authenticated (our auth gate, not pg permission denied)
