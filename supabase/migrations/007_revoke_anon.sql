-- ============================================================
-- 007_revoke_anon.sql — Harden authenticated-only RPC permissions
--
-- Background: Supabase default privileges automatically grant
-- EXECUTE on every new public-schema function to both anon and
-- authenticated. REVOKE FROM PUBLIC (used in 005 and 006) strips
-- the PUBLIC pseudo-role grant but leaves any explicit per-role
-- grants from those default privileges intact. As a result, anon
-- could still invoke authenticated-only functions and the only
-- gate was the auth.uid() IS NULL check inside the function body.
--
-- This migration adds explicit REVOKE FROM anon for each
-- authenticated-only RPC so that the GRANT line — not the
-- function body — is the real perimeter.
--
-- ── Convention for all SECURITY DEFINER RPCs going forward ───
--
--   Anon-callable (guest operations):
--     REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC;
--     GRANT  EXECUTE ON FUNCTION <fn> TO anon;
--     (no GRANT to authenticated — anon is a separate role)
--
--   Auth-only (host operations):
--     REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC;
--     REVOKE EXECUTE ON FUNCTION <fn> FROM anon;
--     GRANT  EXECUTE ON FUNCTION <fn> TO authenticated;
--
-- ── Functions NOT touched here (anon-callable by design) ─────
--   public.insert_response(uuid, text, text, text, uuid[])
--   public.get_response_by_token(text)
--   public.update_response_by_token(text, text, text, text, uuid[])
-- ============================================================


-- ── update_host_profile ──────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.update_host_profile(text) FROM anon;

-- ── set_event_status ─────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.set_event_status(uuid, text) FROM anon;

-- ── create_event_with_items ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_event_with_items(
  text, text, text, timestamptz, text, int, timestamptz, text, jsonb
) FROM anon;


-- ============================================================
-- Test queries (run manually as a superuser or via psql after
-- SET ROLE to test each role context)
-- ============================================================
--
-- ── NEGATIVE: anon must now get permission denied ────────────
--
-- SET ROLE anon;
--
-- SELECT public.update_host_profile('Hacker');
-- -- Expected: ERROR: permission denied for function update_host_profile
-- -- (NOT 'unauthenticated' — that would mean REVOKE didn't take effect)
--
-- SELECT public.set_event_status(
--   '00000000-0000-0000-0000-000000000000'::uuid, 'active'
-- );
-- -- Expected: ERROR: permission denied for function set_event_status
--
-- SELECT * FROM public.create_event_with_items(
--   'Test', 'test-slug', 'Venue',
--   now() + interval '7 days', null, 3,
--   now() + interval '5 days', 'active',
--   '[{"name":"Dish"}]'::jsonb
-- );
-- -- Expected: ERROR: permission denied for function create_event_with_items
--
-- RESET ROLE;
--
-- ── POSITIVE: authenticated must still succeed ────────────────
--
-- (Set a valid JWT / SET LOCAL role authenticated + set local
--  request.jwt.claims to a real host uid, then:)
--
-- SELECT public.update_host_profile('Alice');
-- -- Expected: success (updates hosts.name, sets onboarded_at)
--
-- SELECT public.set_event_status(<real_event_id>, 'closed');
-- -- Expected: success (or 'not_found' if event doesn't belong to caller)
--
-- SELECT * FROM public.create_event_with_items(
--   'My Lunch', 'my-lunch-x4k2', 'The Venue',
--   now() + interval '7 days', 'Come hungry', 3,
--   now() + interval '5 days', 'draft',
--   '[{"name":"Butter Chicken"},{"name":"Naan"}]'::jsonb
-- );
-- -- Expected: one row returned (event_id uuid, slug text)
--
-- ── REGRESSION: anon-callable RPCs must still work ───────────
--
-- SET ROLE anon;
--
-- SELECT * FROM public.insert_response(
--   '<real_active_event_id>'::uuid,
--   'Test Guest', null, null,
--   ARRAY['<real_menu_item_id>']::uuid[]
-- );
-- -- Expected: success — returns {id, edit_token}
-- -- (Failure here means we accidentally revoked anon on this fn)
--
-- RESET ROLE;
