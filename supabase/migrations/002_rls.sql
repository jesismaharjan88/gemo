-- ============================================================
-- 002_rls.sql — Enable RLS, define row-level policies
--
-- Policy test cases are documented inline.
-- Positive = query should return/affect rows.
-- Negative = query should return empty / error (RLS filters or blocks).
-- ============================================================


-- ============================================================
-- hosts
-- ============================================================
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

-- A host can read their own profile
-- POSITIVE: logged in as uid='abc', SELECT * FROM hosts WHERE id='abc'  → returns row
-- NEGATIVE: logged in as uid='abc', SELECT * FROM hosts WHERE id='xyz'  → 0 rows
CREATE POLICY "hosts_select_own"
  ON public.hosts FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- A host can update their own profile
-- POSITIVE: UPDATE hosts SET name='New' WHERE id=auth.uid()  → 1 row updated
-- NEGATIVE: UPDATE hosts SET name='Hack' WHERE id='other-uid'  → 0 rows updated
CREATE POLICY "hosts_update_own"
  ON public.hosts FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ============================================================
-- events
-- ============================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Host can SELECT their own events
-- POSITIVE: host A selects events where host_id = A's uid  → sees own events
-- NEGATIVE: host A selects events where host_id = B's uid  → 0 rows (not 403)
CREATE POLICY "events_host_select"
  ON public.events FOR SELECT
  TO authenticated
  USING (host_id = auth.uid());

-- Host can INSERT events (must be their own)
-- POSITIVE: INSERT events (..., host_id=auth.uid(), ...)  → succeeds
-- NEGATIVE: INSERT events (..., host_id='other-uid', ...)  → policy check fails
CREATE POLICY "events_host_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

-- Host can UPDATE their own events
-- POSITIVE: UPDATE events SET title='New' WHERE id=<own event>  → 1 row
-- NEGATIVE: UPDATE events SET status='closed' WHERE host_id='other'  → 0 rows
CREATE POLICY "events_host_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Host can DELETE their own events
-- POSITIVE: DELETE FROM events WHERE id=<own event>  → 1 row
-- NEGATIVE: DELETE FROM events WHERE id=<other host's event>  → 0 rows
CREATE POLICY "events_host_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- Anonymous guests can SELECT active events only
-- POSITIVE: anon selects event with status='active'  → returns row
-- NEGATIVE: anon selects event with status='draft'   → 0 rows
-- NEGATIVE: anon selects event with status='closed'  → 0 rows
CREATE POLICY "events_anon_select_active"
  ON public.events FOR SELECT
  TO anon
  USING (status = 'active');


-- ============================================================
-- menu_items
-- ============================================================
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Host can SELECT items on their own events
-- POSITIVE: host A selects items for event owned by A  → sees items
-- NEGATIVE: host A selects items for event owned by B  → 0 rows
CREATE POLICY "menu_items_host_select"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Host can INSERT items on their own events
-- POSITIVE: INSERT menu_items (event_id=<own event>, ...)  → succeeds
-- NEGATIVE: INSERT menu_items (event_id=<other's event>, ...)  → policy check fails
CREATE POLICY "menu_items_host_insert"
  ON public.menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Host can UPDATE items on their own events
CREATE POLICY "menu_items_host_update"
  ON public.menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Host can DELETE items on their own events
CREATE POLICY "menu_items_host_delete"
  ON public.menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Anonymous guests can SELECT items belonging to active events
-- POSITIVE: anon selects items for an active event  → returns items
-- NEGATIVE: anon selects items for a draft event    → 0 rows
CREATE POLICY "menu_items_anon_select_active"
  ON public.menu_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.status = 'active'
    )
  );


-- ============================================================
-- responses
-- ============================================================
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Host can SELECT responses on their own events
-- POSITIVE: host A reads responses for event owned by A  → sees responses
-- NEGATIVE: host A reads responses for event owned by B  → 0 rows
CREATE POLICY "responses_host_select"
  ON public.responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Host can UPDATE responses on their own events (e.g. admin notes)
CREATE POLICY "responses_host_update"
  ON public.responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- Host can DELETE responses on their own events
CREATE POLICY "responses_host_delete"
  ON public.responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.host_id = auth.uid()
    )
  );

-- No direct anon INSERT/SELECT/UPDATE on responses.
-- All guest mutations/reads go through SECURITY DEFINER RPCs:
--   insert_response()          — initial form submit
--   get_response_by_token()    — pre-fill edit form
--   update_response_by_token() — edit form submit


-- ============================================================
-- response_picks
-- ============================================================
ALTER TABLE public.response_picks ENABLE ROW LEVEL SECURITY;

-- Host can SELECT picks for their events' responses
-- POSITIVE: host A selects picks for response on event owned by A  → sees picks
-- NEGATIVE: host A selects picks for response on event owned by B  → 0 rows
CREATE POLICY "response_picks_host_select"
  ON public.response_picks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.responses r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.id = response_id AND e.host_id = auth.uid()
    )
  );

-- Host can INSERT picks (e.g. admin corrections)
CREATE POLICY "response_picks_host_insert"
  ON public.response_picks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.responses r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.id = response_id AND e.host_id = auth.uid()
    )
  );

-- Host can DELETE picks (e.g. admin corrections)
CREATE POLICY "response_picks_host_delete"
  ON public.response_picks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.responses r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.id = response_id AND e.host_id = auth.uid()
    )
  );

-- No direct anon access to response_picks.
-- Managed exclusively via insert_response() and update_response_by_token() RPCs.
