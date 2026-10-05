-- 1. Create a table for User Profiles (maps to AuthUser)
-- email is nullable: GitHub can return no email, and an empty string would collide
-- with every other empty string under the unique constraint. Postgres already allows
-- unlimited nulls in a unique column, so real duplicates are still rejected.
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  name text,
  avatar_url text,
  provider text,
  github_username text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create a table for Subscriptions (maps to SubscriptionInfo)
create table public.subscriptions (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  status text not null check (status in ('free', 'pro')),
  plan text not null check (plan in ('free', 'pro', 'teams', 'enterprise')),
  renews_at timestamp with time zone,
  ends_at timestamp with time zone,
  capabilities jsonb default '{"intelligence": false, "hostedAi": false, "settingsSync": true, "cloudWorkspaces": false, "collaboration": false, "enterprisePolicy": false}'::jsonb
);

-- 3. Create a table for Extensions/Marketplace
create table public.extensions (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  version text not null,
  description text,
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.extensions enable row level security;

-- Profiles: Users can only read and update their own profile
create policy "Users can view own profile" on public.profiles
  for select using ( auth.uid() = id );
create policy "Users can update own profile" on public.profiles
  for update using ( auth.uid() = id );

-- Subscriptions: Users can only read their own subscription
create policy "Users can view own subscription" on public.subscriptions
  for select using ( auth.uid() = user_id );
-- Subscriptions are written by the backend only.
create policy "Service role can update subscriptions" on public.subscriptions
  for update using ( false );

-- Extensions: Anyone authenticated can view extensions
create policy "Anyone can view extensions" on public.extensions
  for select using ( true );

-- 4. Trigger to create a profile and free subscription when a user signs up.
--
-- Each insert is wrapped in its own exception block so a failure degrades to a
-- warning instead of aborting the INSERT into auth.users. Without this, one bad
-- row would lock the user out of signing in at all, which is worse than a
-- missing profile. on conflict do nothing (no conflict target) absorbs a clash on
-- any unique constraint, including a duplicate email, so the trigger is idempotent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, email, name, avatar_url, provider, github_username)
    values (
      new.id,
      nullif(new.email, ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      new.raw_app_meta_data->>'provider',
      nullif(new.raw_user_meta_data->>'preferred_username', '')
    )
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user: profile insert failed: %', sqlerrm;
  end;

  begin
    insert into public.subscriptions (user_id, status, plan)
    values (new.id, 'free', 'free')
    on conflict do nothing;
  exception when others then
    raise warning 'handle_new_user: subscription insert failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Self-healing backstop for a profile that never got its free subscription.
--
-- The trigger can be skipped when the profile insert fails on a duplicate email.
-- The app calls this on the first authenticated request so the account still ends
-- up usable. Idempotent, so calling it on every sign-in costs one no-op insert.
create or replace function public.ensure_free_subscription()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, status, plan)
  values (auth.uid(), 'free', 'free')
  on conflict do nothing;
end;
$$;

grant execute on function public.ensure_free_subscription() to authenticated;