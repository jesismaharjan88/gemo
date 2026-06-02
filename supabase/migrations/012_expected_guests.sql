-- ============================================================
-- 012_expected_guests.sql
--
-- events.expected_guest_count already exists (added in 001_init.sql).
-- This migration:
--   1. Adds a CHECK constraint guarding against zero/negative values.
--   2. Adds the set_expected_guests RPC for inline tally-page editing.
-- ============================================================

-- Add CHECK constraint idempotently (pg_constraint name is deterministic).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname      = 'events_expected_guest_count_check'
       and conrelid     = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_expected_guest_count_check
      check (expected_guest_count is null or expected_guest_count > 0);
  end if;
end $$;


-- ============================================================
-- RPC: set_expected_guests
--
-- Updates events.expected_guest_count for an event owned by the caller.
-- p_count = null clears the field.
-- Raises not_found (P0002) for missing or cross-host events.
-- Raises invalid_count (23514) for p_count <= 0.
-- ============================================================
create or replace function public.set_expected_guests(
  p_event_id uuid,
  p_count    integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Validate before touching the row so a bad count never partially updates.
  if p_count is not null and p_count <= 0 then
    raise exception 'invalid_count' using errcode = '23514';
  end if;

  update public.events
     set expected_guest_count = p_count,
         updated_at           = now()
   where id      = p_event_id
     and host_id = auth.uid();

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_expected_guests(uuid, integer) from public, anon;
grant execute on function public.set_expected_guests(uuid, integer) to authenticated;


-- ============================================================
-- Manual test queries (run in Supabase SQL editor as service role
-- after SET LOCAL role = authenticated; SET LOCAL request.jwt.claims = '{"sub":"<host_uid>"}';
-- or just test via a browser session with the Supabase client).
--
-- (a) Valid count  → row updated, updated_at bumped.
-- SELECT public.set_expected_guests('<owned_event_id>', 20);
-- SELECT expected_guest_count, updated_at FROM public.events WHERE id = '<owned_event_id>';
--
-- (b) Cross-host   → not_found, no row changed.
-- SELECT public.set_expected_guests('<other_hosts_event_id>', 10);
--
-- (c) Zero / negative → invalid_count.
-- SELECT public.set_expected_guests('<owned_event_id>', 0);
-- SELECT public.set_expected_guests('<owned_event_id>', -5);
--
-- (d) Null (clear) → expected_guest_count set to NULL.
-- SELECT public.set_expected_guests('<owned_event_id>', null);
-- ============================================================
