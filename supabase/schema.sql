/**
 * ONBEAT – DATABASE SCHEMA
 *
 * REFERENCE FROM
 * https://supabase.com/docs/guides
 */

create table if not exists public.track_analysis (
  spotify_track_id text primary key,
  title            text not null,
  artist           text not null,
  duration_ms      integer,
  bpm              numeric,
  music_key        text,
  mode             text,
  camelot          text,
  energy           numeric,
  danceability     numeric,
  happiness        numeric,
  matched_slug     text,
  source           text not null default 'soundnet',
  status           text not null default 'ok' check (status in ('ok', 'not_found', 'error')),
  analyzed_at      timestamptz not null default now()
);

create table if not exists public.track_cues (
  spotify_track_id text not null,
  at_ms            integer not null check (at_ms >= 0),
  kind             text not null check (kind in ('drop', 'build', 'chorus', 'breakdown', 'outro')),
  lead_ms          integer not null default 12000 check (lead_ms >= 0),
  push_bpm         integer,
  hold_ms          integer,
  label            text,
  source           text not null default 'manual',
  primary key (spotify_track_id, at_ms)
);

create table if not exists public.runs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  started_at         timestamptz not null,
  ended_at           timestamptz not null,
  moving_ms          integer not null,
  distance_m         integer not null,
  avg_pace_ms_per_km integer,
  total_steps        integer,
  avg_cadence_spm    integer,
  goal_type          text check (goal_type in ('time', 'distance')),
  goal_amount        integer,
  playlist_id        text,
  plan               jsonb not null default '[]'::jsonb,
  adjustments        jsonb not null default '[]'::jsonb,
  route              jsonb not null default '[]'::jsonb,
  adaptive_mode      boolean,
  trace              jsonb,
  created_at         timestamptz not null default now(),
  unique (user_id, started_at)
);

create index if not exists track_analysis_status_analyzed_idx
  on public.track_analysis (status, analyzed_at);

create index if not exists runs_user_started_idx
  on public.runs (user_id, started_at desc);

alter table public.track_analysis enable row level security;
alter table public.track_cues     enable row level security;
alter table public.runs           enable row level security;

drop policy if exists "authenticated read" on public.track_analysis;
create policy "authenticated read" on public.track_analysis
  for select to authenticated using (true);

drop policy if exists "authenticated read cues" on public.track_cues;
create policy "authenticated read cues" on public.track_cues
  for select to authenticated using (true);

drop policy if exists "own runs read" on public.runs;
create policy "own runs read" on public.runs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own runs insert" on public.runs;
create policy "own runs insert" on public.runs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own runs delete" on public.runs;
create policy "own runs delete" on public.runs
  for delete to authenticated using (auth.uid() = user_id);
