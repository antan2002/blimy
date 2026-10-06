-- Plus and Pro tiers
--
-- 20261003234300_plans_and_quotas.sql defines all three tiers, but it stopped partway on a
-- duplicate policy and never reached `apply_plan_capabilities()`. That leaves two gaps:
--
--   1. `plans` may hold only the rows that were inserted before the failure, so `plus` and
--      `pro` can be missing, and `free` can carry the older stricter capability shape.
--   2. Nothing can move an account between tiers. Without `apply_plan_capabilities()` a
--      manual `update` can set `status` to `pro` while leaving the capability snapshot at
--      `ownModelsOnly: true`, which is exactly the drift PLANS.md warns about.
--
-- This migration is re-runnable and changes no product behaviour. It only makes the three
-- tiers real and makes them reachable for testing.

-- 0. Widen `subscriptions` to accept `plus`.
--
-- The table shipped with `check (status in ('free','pro'))` and
-- `check (plan in ('free','pro','teams','enterprise'))`. 20261003234300 intended to replace
-- both with versions that include `plus`, but it stopped before reaching them. Until that
-- happens any write of `plus` is rejected by the constraint, so the tier cannot exist no
-- matter what the plan row says.
--
-- There is no `updated_at` column on this table, so nothing below pretends otherwise.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('free', 'plus', 'pro')),
  add constraint subscriptions_plan_check check (plan in ('free', 'plus', 'pro', 'teams', 'enterprise'));

-- The default snapshot shipped without `ownModelsOnly`, so a row created by any path that
-- omits capabilities would disagree with the free plan row. Align it.
alter table public.subscriptions
  alter column capabilities set default '{
     "intelligence": false,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": false,
     "collaboration": false,
     "enterprisePolicy": false,
     "ownModelsOnly": true
   }'::jsonb;

-- 1. The three tiers, as one table the rest of the system reads.
--
-- `status` is the entitlement. `capabilities` is a snapshot derived from it, kept only so the
-- client can read the whole entitlement in one query. Zero limits mean unlimited.
insert into public.plans (status, monthly_requests, daily_requests, capabilities)
values
  -- Own Blimy models, a monthly allowance, no cloud.
  ('free', 500, 0, '{
     "intelligence": false,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": false,
     "collaboration": false,
     "enterprisePolicy": false,
     "ownModelsOnly": true
   }'),
  -- Everything free has, plus cloud, plus a daily allowance that resets at midnight UTC.
  ('plus', 0, 200, '{
     "intelligence": true,
     "hostedAi": true,
     "settingsSync": true,
     "cloudWorkspaces": true,
     "collaboration": false,
     "enterprisePolicy": false,
     "ownModelsOnly": true
   }'),
  -- Everything on, no quota at all.
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

-- 2. Derive a subscription's capability snapshot from its status.
--
-- SECURITY DEFINER because it writes across the RLS boundary, and service_role only because
-- it can set any user's capabilities. Nothing else should need this: the app reads
-- entitlements, it does not author them.
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
   where p.status = s.status
     and s.user_id = target_user;
end;
$$;

-- 3. Move your own account between tiers, for testing, without a payment provider.
--
-- The guard is an email comparison, which is not an authorisation system. This function is a
-- privilege escalation by design and is the reason the file it belongs to is marked
-- development-only. See PLANS.md.
create or replace function public.dev_set_plan(target_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
   target_user uuid := auth.uid();
   snapshot jsonb;
   allowance record;
begin
   if target_user is null then
      raise exception 'not signed in';
   end if;

   -- Only the project owner may move a tier. Nothing else in the product can.
   if lower(auth.jwt() ->> 'email') is distinct from 'antanroy502@gmail.com' then
      raise exception 'dev_set_plan is restricted to the project owner';
   end if;

   if target_status not in ('free', 'plus', 'pro') then
      raise exception 'unknown status: %', target_status;
   end if;

   select monthly_requests, daily_requests, capabilities
   into allowance
   from public.plans
   where status = target_status;

   if not found then
      raise exception 'no plan row for status: %', target_status;
   end if;
   snapshot := allowance.capabilities;

   -- Create the row if the signup trigger never ran, so a switch always lands somewhere.
   insert into public.subscriptions (user_id, status, plan, capabilities)
   values (target_user, target_status, target_status, snapshot)
   on conflict (user_id) do update
      set status = excluded.status,
          plan = excluded.plan,
          capabilities = excluded.capabilities,
          renews_at = null,
          ends_at = null;

   -- Start the new tier with empty counters, so a limit can be observed from zero rather
   -- than inherited from the previous tier.
   delete from public.usage_counters where user_id = target_user;

   -- Per-model usage is what the AI Overview reads, so it has to be cleared alongside the
   -- quota counters or the new tier shows the previous tier's history.
   delete from public.usage_by_model where user_id = target_user;

   return jsonb_build_object(
      'status', target_status,
      'plan', target_status,
      'capabilities', snapshot,
      'monthly_limit', allowance.monthly_requests,
      'daily_limit', allowance.daily_requests,
      'monthly_used', 0,
      'daily_used', 0
   );
end;
$$;

-- Read back the whole entitlement while testing a tier. Same guard as the switch.
create or replace function public.dev_entitlement()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
     'status', s.status,
     'plan', s.plan,
     'capabilities', s.capabilities,
     'capabilities_match_plan', s.capabilities is not distinct from p.capabilities,
     'monthly_limit', coalesce(p.monthly_requests, 0),
     'daily_limit', coalesce(p.daily_requests, 0),
     'monthly_used', coalesce((select m.requests from public.usage_counters m
                               where m.user_id = s.user_id and m.scope = 'month'
                                 and m.period = date_trunc('month', timezone('utc'::text, now())::date)), 0),
     'daily_used', coalesce((select d.requests from public.usage_counters d
                             where d.user_id = s.user_id and d.scope = 'day'
                               and d.period = timezone('utc'::text, now())::date), 0)
  )
  from public.subscriptions s
  left join public.plans p on p.status = s.status
  where s.user_id = auth.uid()
    and lower(auth.jwt() ->> 'email') = 'antanroy502@gmail.com';
$$;

-- 4. Execute grants.
--
-- `dev_set_plan` and `dev_entitlement` are granted to `authenticated`, not to service_role:
-- they read auth.uid() and are meant to be called as the signed-in owner. The email guard
-- inside them is what restricts them.
--
-- `my_entitlement()` was missed when the earlier migration tightened the others, so it is
-- still callable by anon. It reads through auth.uid() and returns nothing to a caller with
-- no session, but it should not be reachable at all.
--
-- revoke goes through a conditional DO block because a bare `revoke` on a function that does
-- not exist is a hard error, and these migrations have a history of stopping halfway.
do $$
declare
   fn text;
   fn_role text;
begin
   foreach fn in array array[
      'public.my_entitlement()',
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
      -- named parameter, so `apply_plan_capabilities(target_user uuid)` was silently skipped
      -- and kept its default PUBLIC execute grant.
      if to_regprocedure(fn) is not null then
        execute format('revoke execute on function %s from public, anon', fn);
        execute format('grant execute on function %s to %s', fn, fn_role);
      end if;
   end loop;
end;
$$;

-- `create or replace` resets execute privileges to the default, which grants PUBLIC. Adding
-- `to authenticated` below would not take that away, so the revoke is explicit. The email
-- guard inside each function is the real defence; this keeps anon from reaching them at all.
revoke execute on function public.dev_set_plan(text) from public, anon;
revoke execute on function public.dev_entitlement() from public, anon;
grant execute on function public.dev_set_plan(text) to authenticated;
grant execute on function public.dev_entitlement() to authenticated;