-- ============================================================
-- 001_init.sql — Tables, indexes, role grants
-- ============================================================

-- Enable pgcrypto for gen_random_bytes (used in RPCs)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ------------------------------------------------------------
-- hosts  (1:1 profile for auth.users)
-- ------------------------------------------------------------
CREATE TABLE public.hosts (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text,
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- events
-- ------------------------------------------------------------
CREATE TABLE public.events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id              uuid        NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  slug                 text        UNIQUE NOT NULL,
  title                text        NOT NULL,
  venue_name           text,
  venue_address        text,
  event_datetime       timestamptz,
  description          text,
  max_picks_per_guest  int         NOT NULL DEFAULT 3
                                   CHECK (max_picks_per_guest BETWEEN 1 AND 10),
  expected_guest_count int,        -- for "X of Y" display on admin page
  response_deadline    timestamptz,
  status               text        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('draft','active','closed','archived')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
CREATE TABLE public.menu_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  category    text,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- responses
-- ------------------------------------------------------------
CREATE TABLE public.responses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_name   text        NOT NULL,
  guest_phone  text,
  edit_token   text        UNIQUE NOT NULL,
  notes        text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- response_picks
-- ------------------------------------------------------------
CREATE TABLE public.response_picks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   uuid NOT NULL REFERENCES public.responses(id)  ON DELETE CASCADE,
  menu_item_id  uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  UNIQUE (response_id, menu_item_id)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX ON public.events        (host_id);
CREATE INDEX ON public.events        (slug);
CREATE INDEX ON public.menu_items    (event_id);
CREATE INDEX ON public.responses     (event_id);
CREATE INDEX ON public.responses     (edit_token);
CREATE INDEX ON public.response_picks (response_id);
CREATE INDEX ON public.response_picks (menu_item_id);

-- ------------------------------------------------------------
-- Role grants  (RLS controls row-level access; these grant
-- table-level visibility to the Data API roles)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- events: anon reads; host writes
GRANT SELECT                    ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- menu_items: anon reads; host writes
GRANT SELECT                    ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

-- responses: no direct anon access (all guest mutations go via RPCs)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated;

-- response_picks: no direct anon access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_picks TO authenticated;

-- hosts: authenticated only
GRANT SELECT, UPDATE ON public.hosts TO authenticated;
