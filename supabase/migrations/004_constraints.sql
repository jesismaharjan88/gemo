-- ============================================================
-- 004_constraints.sql — Additional CHECK constraints
-- ============================================================

-- Slugs must be lowercase, alphanumeric + hyphens, no leading/trailing hyphens,
-- at least 3 chars. This matches what generateSlug() in lib/utils/slug.ts produces.
ALTER TABLE public.events
  ADD CONSTRAINT events_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$');
