-- =============================================================================
-- Bullet Heaven — M3: server-authoritative progression
--
-- Replaces the M2-era `profiles` table (which mirrored the local SaveData shape)
-- with a server-authoritative one, and adds per-match + leaderboard tables plus
-- the submit_match() RPC that computes rewards on the server.
--
-- DROP safety (audited before writing this migration):
--   * Nothing FKs to public.profiles — runs.user_id references auth.users, not
--     profiles — so DROP ... CASCADE only removes the profiles-attached trigger
--     (profiles_set_updated_at) and its RLS policies.
--   * public.runs and public.leaderboard (view) are intentionally left intact so
--     the existing submit-run / leaderboard Edge Functions keep working. They are
--     now redundant alongside match_results / leaderboard_entries — slated for
--     M4 cleanup.
--   * The handle_new_user() trigger on auth.users survives the drop and still
--     works against the new table (it inserts (id) only; all else defaults).
--   * NOTE for M4: the sync-profile Edge Function references `owned_characters`,
--     which this migration renames to `characters`; do not call sync-profile
--     until it is updated.
-- =============================================================================

drop table if exists public.leaderboard_entries cascade;
drop table if exists public.match_results     cascade;
drop table if exists public.profiles          cascade;

-- ===== tables =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  level int not null default 1,
  xp int not null default 0,
  coins int not null default 0,
  gems int not null default 0,
  best_score int not null default 0,
  upgrades jsonb not null default '{}'::jsonb,          -- { "vitality":3, "greed":2 }
  characters text[] not null default array['ranger'],   -- unlocked character ids
  equipped_character text not null default 'ranger',
  created_at timestamptz not null default now()
);

create table match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  score int not null,
  coins_earned int not null default 0,
  xp_earned int not null default 0,
  duration_seconds int not null,
  created_at timestamptz not null default now()
);
create index on match_results (user_id, created_at desc);

create table leaderboard_entries (
  user_id uuid not null references profiles(id) on delete cascade,
  season text not null,
  best_score int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, season)
);
create index on leaderboard_entries (season, best_score desc);

-- ===== RLS =====
alter table profiles enable row level security;
alter table match_results enable row level security;
alter table leaderboard_entries enable row level security;

create policy "profiles readable by authenticated"
  on profiles for select to authenticated using (true);
create policy "insert own profile"
  on profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile"
  on profiles for update to authenticated using (id = auth.uid());

create policy "read own matches"
  on match_results for select to authenticated using (user_id = auth.uid());

create policy "leaderboard readable"
  on leaderboard_entries for select to authenticated using (true);

-- ===== submit_match RPC (server-authoritative rewards) =====
create or replace function submit_match(
  p_duration int, p_kills int, p_level int
) returns table (score int, coins int, xp int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_base   int; v_coins int; v_xp int; v_greed int;
  v_season text := to_char(now(), 'IYYY"-W"IW');
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- plausibility: reject impossible runs
  if p_duration < 0 or p_duration > 3600
     or p_kills < 0 or p_kills > p_duration * 30
     or p_level < 1 or p_level > 1 + p_duration / 5
  then raise exception 'implausible run'; end if;

  -- rewards computed server-side; never trust the client's numbers
  v_base  := floor(p_duration * 0.5 + p_kills + p_level * 5);
  v_greed := coalesce((select (upgrades->>'greed')::int from profiles where id = v_uid), 0);
  v_coins := floor(v_base * (1 + v_greed * 0.10));   -- Greed: +10% coins/level
  v_xp    := p_kills + p_level * 10;

  insert into match_results(user_id, score, coins_earned, xp_earned, duration_seconds)
  values (v_uid, v_base, v_coins, v_xp, p_duration);

  update profiles set coins = coins + v_coins, xp = xp + v_xp,
                      best_score = greatest(best_score, v_base)
   where id = v_uid;

  insert into leaderboard_entries(user_id, season, best_score)
  values (v_uid, v_season, v_base)
  on conflict (user_id, season) do update
     set best_score = greatest(leaderboard_entries.best_score, excluded.best_score),
         updated_at = now();

  return query select v_base, v_coins, v_xp;
end $$;
