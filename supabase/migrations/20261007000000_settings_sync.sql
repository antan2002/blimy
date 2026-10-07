-- Settings sync
--
-- The app syncs a snapshot of user settings through `GET/PUT /api/account/settings-sync`,
-- which is served by the first-party host in `services.json`. That host no longer answers, so
-- turning on "Cloud settings sync" in Account failed as soon as the snapshot was fetched or
-- pushed.
--
-- This table is the Supabase home for that snapshot: one row per account, written through the
-- `settings-sync` edge function as service_role with the user derived from the JWT. The
-- owner-only policy keeps the row readable by the account it belongs to, and direct anonymous
-- access stays off.

create table if not exists public.settings_sync (
  user_id uuid not null references public.profiles (id) on delete cascade,
  schema_version integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id)
);

alter table public.settings_sync enable row level security;

create policy "Users can read own settings sync"
  on public.settings_sync
  for select
  using ( auth.uid() = user_id );

create policy "Users can update own settings sync"
  on public.settings_sync
  for update
  using ( auth.uid() = user_id );

revoke all on public.settings_sync from anon;