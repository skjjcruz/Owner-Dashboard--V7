-- ============================================================
-- Owner Dashboard V10 — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
-- Keyed on Sleeper username (no OAuth required yet).
-- Each owner is identified by the Sleeper username they log in with.
create table if not exists public.users (
    id               uuid primary key default gen_random_uuid(),
    sleeper_username text unique not null,
    theme            jsonb    default '{}'::jsonb,   -- owner customisation (future)
    created_at       timestamptz default now()
);

-- ── CALENDAR EVENTS ──────────────────────────────────────────
create table if not exists public.calendar_events (
    id         text primary key,          -- preserves existing ids like 'default-1'
    username   text not null references public.users(sleeper_username) on delete cascade,
    title      text not null,
    date       text not null,             -- stored as 'YYYY-MM-DD' string
    time       text default '',
    league     text default '',
    details    text default '',
    created_at timestamptz default now()
);

-- ── EARNINGS ─────────────────────────────────────────────────
create table if not exists public.earnings (
    id          text primary key,         -- preserves existing ids (Date.now string)
    username    text not null references public.users(sleeper_username) on delete cascade,
    year        text not null,
    league      text default '',
    description text default '',
    amount      numeric not null,
    created_at  timestamptz default now()
);

-- ── PLAYERS (Draft Rankings) ─────────────────────────────────
-- Shared across all users — one row per player per draft year.
-- Populated by the migrate-to-supabase.js admin script.
-- Multiple draft classes coexist via draft_year ('2025', '2026', etc.).
create table if not exists public.players (
    id               serial primary key,
    draft_year       text not null default '2026',

    -- Core identity
    name             text not null,
    pos              text not null default '',
    school           text not null default '',
    year_in_school   text default '',          -- 'Junior', 'RS JR.', etc.

    -- Rankings
    rank             integer not null,         -- consensus rank (row order)
    previous_rank    integer,                  -- for rank-change arrows
    sources          jsonb default '[]'::jsonb, -- [{"source":"PFF","rank":3,"weight":1.0}, ...]

    -- Physical
    size             text default '',          -- e.g. '6''4"'
    weight           text default '',          -- e.g. '243'
    speed            text default '',          -- 40-yard dash e.g. '4.52'

    -- Enrichment
    espn_id          text default '',
    photo_url        text default '',
    summary          text default '',
    fantasy_multiplier numeric default 1.0,

    -- Timestamps
    updated_at       timestamptz default now(),

    unique (draft_year, rank)
);

-- ── FREE AGENCY TARGETS ───────────────────────────────────────
-- One row per (user, league). Targets stored as a JSONB array.
create table if not exists public.fa_targets (
    id             uuid primary key default gen_random_uuid(),
    username       text not null references public.users(sleeper_username) on delete cascade,
    league_id      text not null,
    starting_budget numeric default 1000,
    targets        jsonb default '[]'::jsonb,
    updated_at     timestamptz default now(),
    unique (username, league_id)
);

-- ── DROP EXISTING POLICIES (safe re-run) ─────────────────────
drop policy if exists "users_all"      on public.users;
drop policy if exists "calendar_all"   on public.calendar_events;
drop policy if exists "earnings_all"   on public.earnings;
drop policy if exists "fa_targets_all" on public.fa_targets;
drop policy if exists "players_read"   on public.players;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Each owner can only read/write their own rows.
-- The client passes the Sleeper username in a custom header (x-owner-username)
-- which is exposed via a Postgres function below.

alter table public.users          enable row level security;
alter table public.calendar_events enable row level security;
alter table public.earnings        enable row level security;
alter table public.fa_targets      enable row level security;
alter table public.players         enable row level security;

-- Helper: extract the requesting username from the JWT app_metadata claim.
-- When using the anon key the app embeds the username in app_metadata
-- via a Supabase Edge Function (see SETUP.md).  For the initial rollout
-- we use a simpler "trusting" policy and tighten it once auth is wired up.

-- TEMP open policies (replace with auth-gated ones once login is updated)
create policy "users_all"           on public.users            for all using (true) with check (true);
create policy "calendar_all"        on public.calendar_events  for all using (true) with check (true);
create policy "earnings_all"        on public.earnings         for all using (true) with check (true);
create policy "fa_targets_all"      on public.fa_targets       for all using (true) with check (true);
-- Players are public read / admin write (anon key can only SELECT)
create policy "players_read"        on public.players          for select using (true);

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists idx_calendar_username on public.calendar_events (username);
create index if not exists idx_earnings_username  on public.earnings (username);
create index if not exists idx_fa_username        on public.fa_targets (username);
create index if not exists idx_players_year_rank  on public.players (draft_year, rank);

-- ── DONE ──────────────────────────────────────────────────────
-- After running this file, copy your project URL and anon key
-- from Supabase → Settings → API and paste them into supabase-client.js
