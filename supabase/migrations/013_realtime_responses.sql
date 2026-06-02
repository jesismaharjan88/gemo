-- ============================================================
-- 013_realtime_responses.sql
--
-- Enables Supabase Realtime on responses and response_picks so
-- the tally page can receive live updates without polling.
--
-- Idempotent: the DO block guards against duplicate ALTER PUBLICATION.
-- RLS is unchanged — existing host SELECT policies gate which change
-- events a subscriber receives.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'responses'
  ) then
    alter publication supabase_realtime add table public.responses;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'response_picks'
  ) then
    alter publication supabase_realtime add table public.response_picks;
  end if;
end $$;

-- Full row in UPDATE/DELETE events so RLS can evaluate using the old row.
alter table public.responses      replica identity full;
alter table public.response_picks replica identity full;


-- ============================================================
-- Verification queries (run in Supabase SQL editor):
--
-- Both tables in publication:
-- SELECT tablename FROM pg_publication_tables
--  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
--  ORDER BY tablename;
-- Expected rows: response_picks, responses (alphabetical).
--
-- Replica identity:
-- SELECT relname, relreplident FROM pg_class
--  WHERE relname IN ('responses','response_picks') AND relnamespace = 'public'::regnamespace;
-- Expected: relreplident = 'f' (full) for both.
--
-- Idempotency: running this migration twice should not error.
-- ============================================================
