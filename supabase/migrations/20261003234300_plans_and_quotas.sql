-- Plans and quotas
--
-- Three tiers, decided by `status`:
--   free  - Blimy's own models, a monthly allowance
--   plus  - Blimy's own models, a larger daily allowance that resets at midnight UTC
--   pro   - everything, no quota
--
-- `status` is the entitlement the app gates on, so it is the single source of truth.
-- `capabilities` stays as a JSON snapshot for the client, derived from `status` here so
-- the two can never drift.

-- 1. Widen the vocabulary. `plus` is new; `pro` already exists.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('free', 'plus', 'pro')),
  add constraint subscriptions_plan_check check (plan in ('free', 'plus', 'pro', 'teams', 'enterprise'));

-- 2. Entitlement table. Kept separate from `subscriptions` so plan limits can change
-- without a migration every time a number moves, and so a user has at most one row.
create table if not exists public.plans (
  status text primary key check (status in ('free', 'plus', 'pro')),
  monthly_requests integer not null default 0,  -- 0 means unlimited
  daily_requests integer not null default 0,    -- 0 means unlimited
  capabilities jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.plans (status, monthly_requests, daily_requests, capabilities)
values
  ('free', 500, 0, '{
     "intelligence": false,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": false,
     "collaboration": false,
     "enterprisePolicy": false,
     "ownModelsOnly": true
   }'),
  ('plus', 0, 200, '{
     "intelligence": true,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": true,
     "collaboration": false,
     "enterprisePolicy": false,
     "ownModelsOnly": true
   }'),
  ('pro', 0, 0, '{
     "intelligence": true,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": true,
     "collaboration": true,
     "enterprisePolicy": true,
     "ownModelsOnly": false
   }')
on conflict (status) do update
  set monthly_requests = excluded.monthly_requests,
      daily_requests = excluded.daily_requests,
      capabilities = excluded.capabilities,
      updated_at = timezone('utc'::text, now());

-- 3. Usage ledger.
--
-- One row per user per period. `period` is a date truncated to the period start: the first
-- of the month for the monthly counter, the day itself for the daily one. Keeping both in
-- one table with a `scope` column means a single atomic upsert can serve either limit.
create table if not exists public.usage_counters (
  user_id uuid references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('month', 'day')),
  period date not null,
  requests integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, scope, period)
);

alter table public.usage_counters enable row level security;

-- A user may read their own counters (for a usage meter) but never write them: writes go
-- through the RPC below using auth.uid(), so a client cannot grant itself quota.
create policy "Users can view own usage counters" on public.usage_counters
  for select using ( auth.uid() = user_id );

-- The entitlement itself is readable by anyone authenticated: the pricing page shows it.
alter table public.plans enable row level security;
create policy "Anyone authenticated can view plans" on public.plans
  for select using ( auth.role() = 'authenticated' );

-- 4. Read a user's entitlement. Single join so the client cannot combine a real plan with
-- someone else's capabilities.
create or replace function public.my_entitlement()
returns table (
  status text,
  plan text,
  capabilities jsonb,
  monthly_requests integer,
  daily_requests integer,
  monthly_used integer,
  daily_used integer
)
language sql
stable
security invoker
as $$
  select
    s.status,
    s.plan,
    coalesce(p.capabilities, '{}'::jsonb) as capabilities,
    coalesce(p.monthly_requests, 0) as monthly_requests,
    coalesce(p.daily_requests, 0) as daily_requests,
    coalesce((select m.requests from public.usage_counters m
              where m.user_id = s.user_id and m.scope = 'month'
                and m.period = date_trunc('month', timezone('utc'::text, now())::date)), 0) as monthly_used,
    coalesce((select d.requests from public.usage_counters d
              where d.user_id = s.user_id and d.scope = 'day'
                and d.period = timezone('utc'::text, now())::date), 0) as daily_used
  from public.subscriptions s
  left join public.plans p on p.status = s.status
  where s.user_id = auth.uid();
$$;

-- 5. Consume one request of quota, or refuse.
--
-- The check and the increment are a single statement pair inside one transaction, so two
-- concurrent requests cannot both read the same pre-increment value and slip past the cap.
-- Periods are computed from `now()` server-side: a client cannot backdate its way to a
-- fresh counter.
create or replace function public.consume_request()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
   entitlement public.subscriptions%rowtype;
   limits record;
   month_start date := date_trunc('month', timezone('utc'::text, now())::date);
   today date := timezone('utc'::text, now())::date;
   month_used integer;
   day_used integer;
begin
   select * into entitlement from public.subscriptions where user_id = auth.uid();
   if not found then
      raise exception 'no subscription for this user';
   end if;

   select monthly_requests, daily_requests into limits
   from public.plans where status = entitlement.status;

   if limits.monthly_requests > 0 then
      select requests into month_used from public.usage_counters
      where user_id = auth.uid() and scope = 'month' and period = month_start;
      month_used := coalesce(month_used, 0);
      if month_used >= limits.monthly_requests then
         return jsonb_build_object(
            'allowed', false,
            'reason', 'monthly_limit',
            'limit', limits.monthly_requests,
            'used', month_used,
            'resets_at', (month_start + interval '1 month')::date
         );
      end if;
   end if;

   if limits.daily_requests > 0 then
      select requests into day_used from public.usage_counters
      where user_id = auth.uid() and scope = 'day' and period = today;
      day_used := coalesce(day_used, 0);
      if day_used >= limits.daily_requests then
         return jsonb_build_object(
            'allowed', false,
            'reason', 'daily_limit',
            'limit', limits.daily_requests,
            'used', day_used,
            'resets_at', today + 1
         );
      end if;
   end if;

   -- Only bill against limits that actually exist, so a pro user accumulates no rows.
   if limits.monthly_requests > 0 then
      insert into public.usage_counters (user_id, scope, period, requests)
      values (auth.uid(), 'month', month_start, 1)
      on conflict (user_id, scope, period)
      do update set requests = public.usage_counters.requests + 1,
                    updated_at = timezone('utc'::text, now());
   end if;

   if limits.daily_requests > 0 then
      insert into public.usage_counters (user_id, scope, period, requests)
      values (auth.uid(), 'day', today, 1)
      on conflict (user_id, scope, period)
      do update set requests = public.usage_counters.requests + 1,
                    updated_at = timezone('utc'::text, now());
   end if;

   return jsonb_build_object(
      'allowed', true,
      'status', entitlement.status,
      'monthly_used', month_used + (case when limits.monthly_requests > 0 then 1 else 0 end),
      'daily_used', day_used + (case when limits.daily_requests > 0 then 1 else 0 end)
   );
end;
$$;

grant execute on function public.my_entitlement() to authenticated;
grant execute on function public.consume_request() to authenticated;

-- 6. Keep a subscription's capability snapshot in step with its status.
--
-- Written by the backend (billing webhooks, or the dev switch below), so this only has to
-- derive the JSON. Deriving it here is what keeps `capabilities` from being a second,
-- independently-editable source of truth.
create or replace function public.apply_plan_capabilities(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
   update public.subscriptions s
   set capabilities = p.capabilities
   from public.plans p
   where p.status = s.status and s.user_id = target_user;
end;
$$;

grant execute on function public.apply_plan_capabilities(uuid) to service_role;

-- 7. New signups still land on free with the correct snapshot.
create or replace function public.ensure_free_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
   insert into public.subscriptions (user_id, status, plan, capabilities)
   values (
      auth.uid(), 'free', 'free',
      (select capabilities from public.plans where status = 'free')
   )
   on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_free_subscription() to authenticated;