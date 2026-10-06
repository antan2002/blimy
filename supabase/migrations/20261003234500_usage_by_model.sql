-- Per-model usage counters, so the AI Overview settings page can show what was used and when
-- each limit resets.
--
-- This is separate from `usage_counters` on purpose: that table is one row per user per
-- period, which cannot answer "how much did model X use". Counting here is display only and
-- never blocks a request, so a runaway loop cannot drain the shared upstream key.
--
-- Periods come from the server clock. A client cannot backdate its way to a fresh counter.

create table if not exists public.usage_by_model (
  user_id uuid references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('day', 'month')),
  period date not null,
  model text not null,
  requests integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, scope, period, model)
);

alter table public.usage_by_model enable row level security;

drop policy if exists "Users can view own model usage" on public.usage_by_model;
create policy "Users can view own model usage" on public.usage_by_model
  for select using (auth.uid() = user_id);

-- Reading the summary must not be able to change it, so it stays invoker-side and select-only.
create or replace function public.my_model_usage()
returns table (
  scope text,
  period date,
  model text,
  requests integer,
  resets_at date,
  daily_limit integer,
  monthly_limit integer
)
language sql
stable
security invoker
as $$
  select
    u.scope,
    u.period,
    u.model,
    u.requests,
    case when u.scope = 'day'
      then (timezone('utc'::text, now())::date + 1)
      else (date_trunc('month', timezone('utc'::text, now())::date) + interval '1 month')::date
    end as resets_at,
    p.daily_requests as daily_limit,
    p.monthly_requests as monthly_limit
  from public.usage_by_model u
  join public.subscriptions s on s.user_id = u.user_id
  left join public.plans p on p.status = s.status
  where u.user_id = auth.uid()
    and (
      (u.scope = 'day' and u.period = timezone('utc'::text, now())::date)
      or (u.scope = 'month' and u.period = date_trunc('month', timezone('utc'::text, now())::date))
    )
  order by u.scope, u.requests desc, u.model;
$$;

-- Records one successful request against every open period. Advisory-locked on the user so two
-- concurrent calls cannot both read a pre-increment value.
create or replace function public.record_model_usage(target_model text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
   caller uuid := auth.uid();
   today date := timezone('utc'::text, now())::date;
   month_start date := date_trunc('month', timezone('utc'::text, now())::date);
begin
   if caller is null or target_model is null or btrim(target_model) = '' then
      return;
   end if;

   perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));

   insert into public.usage_by_model (user_id, scope, period, model, requests)
   values
     (caller, 'day', today, target_model, 1),
     (caller, 'month', month_start, target_model, 1)
   on conflict (user_id, scope, period, model)
   do update set requests = public.usage_by_model.requests + 1,
                 updated_at = timezone('utc'::text, now());
end;
$$;

-- Free accounts reach Blimy-hosted models, which is the `hostedAi` capability. `intelligence`
-- stays false for free because it marks a paid tier, and the client keeps cloud workspaces and
-- collaboration behind it.
update public.plans
set capabilities = capabilities
    || jsonb_build_object(
      'intelligence', false,
      'hostedAi', true,
      'ownModelsOnly', true
    ),
    updated_at = timezone('utc'::text, now())
where status = 'free';

-- Existing free subscriptions carry a stale snapshot; copy the plan row's capabilities across
-- directly rather than through apply_plan_capabilities(), which may not exist on a database
-- where the earlier migration stopped partway.
update public.subscriptions s
set capabilities = p.capabilities
from public.plans p
where p.status = s.status
  and s.status = 'free';

-- Postgres grants EXECUTE on a new function to PUBLIC by default, which means the anon role can
-- call every security-definer function in the schema. Narrow that to signed-in callers only.
--
-- revoke is applied through a conditional DO block because a bare `revoke` on a function that
-- does not exist is a hard error, and a migration that half-applied leaves gaps between
-- functions. Every name is checked, and the ones that are present get tightened.
do $$
declare
   fn text;
   fn_role text;
begin
   foreach fn in array array[
      'public.my_model_usage()',
      'public.record_model_usage(text)',
      'public.consume_request()',
      'public.ensure_free_subscription()',
      'public.apply_plan_capabilities(uuid)'
   ] loop
      -- apply_plan_capabilities writes another user's capabilities, so it stays service_role.
      fn_role := case when fn = 'public.apply_plan_capabilities(uuid)'
        then 'service_role' else 'authenticated' end;

      -- Match on the type-only signature, which is the shape the array uses. Comparing
      -- against pg_get_function_identity_arguments() never matched for a function with a
      -- named parameter, so `record_model_usage(target_model text)` was silently skipped and
      -- kept its default PUBLIC execute grant.
      if to_regprocedure(fn) is not null then
        execute format('revoke execute on function %s from public, anon', fn);
        execute format('grant execute on function %s to %s', fn, fn_role);
      end if;
   end loop;
end;
$$;