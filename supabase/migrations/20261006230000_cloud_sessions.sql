-- Cloud sessions sync
--
-- Chat sessions and the share surface were served by the first-party host in `services.json`
-- (`/api/cloud-sessions`, `/api/shares`). That host no longer answers, so live session backup
-- failed with "Could not sync sessions" while every session stayed local-only.
--
-- This table is the Supabase home for that data. It keeps the same shape the client already
-- works with (`SharedItem` plus the private/live agent-session payload), so the client API and
-- the sharing UI can stay as they are. All reads and writes go through the `cloud-sessions`
-- edge function, which runs as service_role and derives the user from the JWT; the owner-only
-- policies below keep the rows readable in place by the right account.
--
-- `revision` is owned by the server and increments on every accepted write, so a second device
-- notices its copy is stale instead of silently overwriting the first one.

create table if not exists public.cloud_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- `source_id`/`device_id` identify the local session a private backup mirrors. They are
  -- nullable because web shares have no such origin.
  source_id text,
  device_id text not null default '',
  title text not null default '',
  kind text not null check (kind in ('snippet', 'buffer', 'agent')),
  visibility text not null default 'private'
    check (visibility in ('private', 'public', 'email', 'organization')),
  live boolean not null default false,
  content text not null default '',
  language text not null default 'text',
  messages jsonb not null default '[]'::jsonb,
  emails jsonb not null default '[]'::jsonb,
  workspace_id bigint,
  revision integer not null default 0,
  source_updated_at bigint,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (id)
);

alter table public.cloud_sessions enable row level security;

create policy "Users can read own cloud sessions"
  on public.cloud_sessions
  for select
  using ( auth.uid() = user_id );

create policy "Users can insert own cloud sessions"
  on public.cloud_sessions
  for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own cloud sessions"
  on public.cloud_sessions
  for update
  using ( auth.uid() = user_id );

create policy "Users can delete own cloud sessions"
  on public.cloud_sessions
  for delete
  using ( auth.uid() = user_id );

create index if not exists cloud_sessions_user_idx
  on public.cloud_sessions (user_id, updated_at desc);

create index if not exists cloud_sessions_source_idx
  on public.cloud_sessions (user_id, source_id, device_id);

-- Per-account sync configuration: whether live backup is on and which sources the account
-- has excluded from it.
create table if not exists public.cloud_sessions_config (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sessions_enabled boolean not null default false,
  excluded_sources jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id)
);

alter table public.cloud_sessions_config enable row level security;

create policy "Users can read own cloud sessions config"
  on public.cloud_sessions_config
  for select
  using ( auth.uid() = user_id );

create policy "Users can update own cloud sessions config"
  on public.cloud_sessions_config
  for update
  using ( auth.uid() = user_id );

-- The edge function runs as service_role, which bypasses RLS, so writes stay reachable the
-- same way ai_settings is written. Direct anonymous access is not part of the product.
revoke all on public.cloud_sessions from anon;
revoke all on public.cloud_sessions_config from anon;