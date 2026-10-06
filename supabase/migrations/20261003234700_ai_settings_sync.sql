-- AI settings sync
--
-- The app syncs its AI model preferences (`defaultConnection`, per-task connections,
-- `autoRouting`) through `GET/PUT /api/account/intelligence`. That path is served by the
-- first-party host in `services.json`, which no longer answers, so a signed-in user with a
-- valid Supabase session still sees "Sign in to sync your AI settings."
--
-- This table is the Supabase home for that data. It replaces no other table: settings sync
-- (`/api/account/settings-sync`) is a separate, wider system with its own store.
--
-- `revision` is owned by the server and increments on every accepted write. It is what lets a
-- second device notice its draft is stale instead of silently overwriting the first one.

create table if not exists public.ai_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Mirrors `IntelligenceScope.id`. "personal" is the only scope the app creates today; the
  -- column is free-form so a team scope can be added without a migration.
  scope text not null default 'personal' check (char_length(scope) between 1 and 64),
  revision integer not null default 0,
  -- Validated shape comes from `parseIntelligencePreferences`, which also tolerates an empty
  -- object by falling back to defaults, so a partially-written row is never fatal.
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id, scope)
);

alter table public.ai_settings enable row level security;

-- A user reads their own preferences directly. Writes never come through this policy: they go
-- through the edge function, which runs as service_role and derives the user from the JWT.
create policy "Users can read own AI settings"
  on public.ai_settings
  for select
  using ( auth.uid() = user_id );

create index if not exists ai_settings_user_scope_idx
  on public.ai_settings (user_id, scope);