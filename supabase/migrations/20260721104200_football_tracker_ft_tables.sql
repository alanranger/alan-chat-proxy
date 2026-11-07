-- MC-29: Football Tracker cache tables (migrated from football-tracker project mdetzgywuwnikhtsxyff)
-- Additive only — no changes to existing alan-chat-rag tables.
-- Applied to igzvwbvgvmzvvzoclufx on 2026-07-21; data copied separately.
-- Source DDL: football predictor/supabase/migrations/001_init.sql

create table if not exists ft_teams (
  fd_id        int  primary key,
  af_id        int,
  comp_code    text not null,
  name         text not null,
  short_name   text,
  group_code   text,
  fifa_rank    int,
  updated_at   timestamptz not null default now()
);
create index if not exists ft_teams_comp_idx on ft_teams (comp_code);
create index if not exists ft_teams_name_idx on ft_teams (lower(name));

create table if not exists ft_matches (
  id              bigserial primary key,
  source          text not null,
  source_match_id text not null,
  comp_code       text not null,
  utc_date        timestamptz not null,
  status          text not null,
  matchday        int,
  stage           text,
  home_id         int,
  away_id         int,
  home_name       text not null,
  away_name       text not null,
  home_score      int,
  away_score      int,
  fetched_at      timestamptz not null default now(),
  unique (source, source_match_id)
);
create index if not exists ft_matches_comp_date_idx
  on ft_matches (comp_code, utc_date);
create index if not exists ft_matches_home_idx on ft_matches (lower(home_name));
create index if not exists ft_matches_away_idx on ft_matches (lower(away_name));

create table if not exists ft_standings (
  id            bigserial primary key,
  comp_code     text not null,
  team_id       int  not null,
  group_code    text,
  position      int  not null,
  played        int, win int, draw int, loss int,
  goals_for     int, goals_against int, points int,
  fetched_at    timestamptz not null default now(),
  unique (comp_code, team_id, group_code)
);
create index if not exists ft_standings_comp_idx on ft_standings (comp_code);

create table if not exists ft_sync_log (
  id            bigserial primary key,
  comp_code     text not null,
  source        text not null,
  ok            boolean not null,
  message       text,
  rows_changed  int,
  fixtures_seen int,
  ran_at        timestamptz not null default now()
);
create index if not exists ft_sync_log_comp_idx on ft_sync_log (comp_code, ran_at desc);

alter table ft_teams      enable row level security;
alter table ft_matches    enable row level security;
alter table ft_standings  enable row level security;
alter table ft_sync_log   enable row level security;

drop policy if exists ft_teams_read     on ft_teams;
drop policy if exists ft_matches_read   on ft_matches;
drop policy if exists ft_standings_read on ft_standings;

create policy ft_teams_read     on ft_teams     for select using (true);
create policy ft_matches_read   on ft_matches   for select using (true);
create policy ft_standings_read on ft_standings for select using (true);
