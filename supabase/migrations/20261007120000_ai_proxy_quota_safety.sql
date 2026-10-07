-- Hosted AI quota safety for the ai-proxy edge function.
--
-- Before this migration the free shared upstream key had two holes: quota was only per-user
-- per month/day with no lock (so a burst could overshoot), and a failed turn still consumed
-- quota because nothing could refund it. This adds:
--   - a per-minute per-user bucket,
--   - a site-wide daily budget shared by every user,
--   - advisory locks so concurrent requests cannot both pass the cap,
--   - refund_request(), which gives quota back when the upstream never answered,
--   - a comprehensive revoke of EXECUTE from public and anon on security-definer functions.
--
-- The quotas were deliberately changed late, because the client is right that "CORS *" and raw
-- provider errors would widen who can try the key. Neither is added here; the function change
-- that pairs with this migration is what keeps error bodies and headers closed.

-- 1. Per-minute per-user bucket. One row per user per UTC minute, so no PITR cleanup is needed:
-- a new minute is simply a new row, and the row count is one per active user-minute.
create table if not exists public.minute_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket timestamp with time zone not null,
  requests integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.minute_usage enable row level security;

-- No select policy: the counters are only read inside security-definer RPCs, so direct reads
-- are denied for everyone and the numbers cannot be scraped.

-- 2. Site-wide daily budget shared by all users. Keyed by UTC day, so the row that a burst
-- would try to race on is a fresh row every midnight.
create table if not exists public.site_request_budget (
  period date not null primary key,
  requests integer not null default 0
);

alter table public.site_request_budget enable row level security;

-- 3. The cap values, as functions rather than constants, so a number can move without a
-- function-body redeploy or a client-side assumption. The edge function reads these when it
-- composes the 429 body.
create or replace function public.ai_minute_per_user_cap()
returns integer
language sql
stable
security invoker
as $$ select case when current_setting('app.settings.ai_minute_cap', true) <> ''
  then greatest(1, current_setting('app.settings.ai_minute_cap', true)::integer)
  else 6 end; $$;

create or replace function public.ai_site_daily_cap()
returns integer
language sql
stable
security invoker
as $$ select case when current_setting('app.settings.ai_site_daily_cap', true) <> ''
  then greatest(1, current_setting('app.settings.ai_site_daily_cap', true)::integer)
  else 1000 end; $$;

-- 4. Replace consume_request with a version that is burst-safe and site-aware.
--
-- The month and day checks are unchanged in spirit, but the whole body now runs under an
-- advisory lock keyed on the caller, and the site budget is checked and incremented under a
-- second advisory lock that is shared by every user. Serializing month/day on the user and the
-- site row on the global lock is what removes the read-then-write overshoot.
create or replace function public.consume_request()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
   caller uuid := auth.uid();
   entitlement public.subscriptions%rowtype;
   limits record;
   month_start date := date_trunc('month', timezone('utc'::text, now())::date);
   today date := timezone('utc'::text, now())::date;
   minute_bucket timestamp with time zone := date_trunc('minute', timezone('utc'::text, now()));
   month_used integer;
   day_used integer;
   minute_used integer;
   global_used integer;
   minute_cap integer := public.ai_minute_per_user_cap();
   global_cap integer := public.ai_site_daily_cap();
begin
   if caller is null then
      return jsonb_build_object('allowed', false, 'reason', 'not_signed_in');
   end if;

   -- The caller's own counters, serialized so two of the same user's requests cannot both read
   -- a pre-increment value.
   perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));

   select * into entitlement from public.subscriptions where user_id = caller;
   if not found then
      return jsonb_build_object('allowed', false, 'reason', 'no_subscription');
   end if;

   select monthly_requests, daily_requests into limits
   from public.plans where status = entitlement.status;

   if limits.monthly_requests > 0 then
      select requests into month_used from public.usage_counters
      where user_id = caller and scope = 'month' and period = month_start;
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
      where user_id = caller and scope = 'day' and period = today;
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

   -- Per-minute. Keyed on the caller inside the caller's own lock, so a paused editor or a
   -- retry loop cannot hammer the shared upstream in a single minute.
   select requests into minute_used from public.minute_usage
   where user_id = caller and bucket = minute_bucket;
   minute_used := coalesce(minute_used, 0);
   if minute_used >= minute_cap then
      return jsonb_build_object(
         'allowed', false,
         'reason', 'minute_limit',
         'limit', minute_cap,
         'used', minute_used,
         'resets_at', minute_bucket + interval '1 minute'
      );
   end if;

   -- Site-wide daily budget. Serialized on a fixed key shared by everyone so the row cannot be
   -- overshot when many users are active at once. The reservation happens here and is returned
   -- on a failed turn by refund_request().
   perform pg_advisory_xact_lock(hashtextextended('blimy-site-budget', 0));
   select requests into global_used from public.site_request_budget where period = today;
   global_used := coalesce(global_used, 0);
   if global_used >= global_cap then
      return jsonb_build_object(
         'allowed', false,
         'reason', 'site_daily_limit',
         'limit', global_cap,
         'used', global_used,
         'resets_at', today + 1
      );
   end if;

   insert into public.site_request_budget (period, requests)
   values (today, 1)
   on conflict (period)
   do update set requests = public.site_request_budget.requests + 1;

   insert into public.minute_usage (user_id, bucket, requests)
   values (caller, minute_bucket, 1)
   on conflict (user_id, bucket)
   do update set requests = public.minute_usage.requests + 1;

   -- Only bill against limits that actually exist, so a pro user accumulates no rows.
   if limits.monthly_requests > 0 then
      insert into public.usage_counters (user_id, scope, period, requests)
      values (caller, 'month', month_start, 1)
      on conflict (user_id, scope, period)
      do update set requests = public.usage_counters.requests + 1,
                    updated_at = timezone('utc'::text, now());
   end if;

   if limits.daily_requests > 0 then
      insert into public.usage_counters (user_id, scope, period, requests)
      values (caller, 'day', today, 1)
      on conflict (user_id, scope, period)
      do update set requests = public.usage_counters.requests + 1,
                    updated_at = timezone('utc'::text, now());
   end if;

   return jsonb_build_object(
      'allowed', true,
      'status', entitlement.status,
      'monthly_used', month_used + (case when limits.monthly_requests > 0 then 1 else 0 end),
      'daily_used', day_used + (case when limits.daily_requests > 0 then 1 else 0 end),
      'minute_used', minute_used + 1,
      'site_used', global_used + 1,
      'minute_limit', minute_cap,
      'site_limit', global_cap
   );
end;
$$;

-- 5. Refund one request when the turn failed before the provider produced anything. Only the
-- caller's own counters are touched, and it is idempotent: the floor of each counter is zero,
-- so a double refund cannot push a user below a spend they really made.
create or replace function public.refund_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
   caller uuid := auth.uid();
   today date := timezone('utc'::text, now())::date;
   month_start date := date_trunc('month', timezone('utc'::text, now())::date);
   minute_bucket timestamp with time zone := date_trunc('minute', timezone('utc'::text, now()));
begin
   if caller is null then
      return;
   end if;

   perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
   perform pg_advisory_xact_lock(hashtextextended('blimy-site-budget', 0));

   update public.usage_counters
   set requests = greatest(requests - 1, 0)
   where user_id = caller and scope = 'day' and period = today;
   update public.usage_counters
   set requests = greatest(requests - 1, 0)
   where user_id = caller and scope = 'month' and period = month_start;
   update public.minute_usage
   set requests = greatest(requests - 1, 0)
   where user_id = caller and bucket = minute_bucket;
   update public.site_request_budget
   set requests = greatest(requests - 1, 0)
   where period = today;
end;
$$;

-- 6. Revoke EXECUTE from public and anon on every security-definer function in the public
-- schema, then grant each one to the only roles that should reach it. Postgres grants EXECUTE
-- on a new function to PUBLIC by default, so a security-definer function that slips past a
-- name list stays callable by anon; iterating pg_proc closes that for current and future
-- functions at once. Identity arguments are used instead of raw typing because a named
-- parameter makes the two disagree (see record_model_usage in the usage_by_model migration).
do $$
declare
   fn record;
begin
   for fn in
      select
         n.nspname,
         p.proname,
         pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and p.prosecdef
   loop
      execute format(
         'revoke all on function %I.%I(%s) from public, anon',
         fn.nspname, fn.proname, fn.args
      );
   end loop;
end;
$$;

-- Reapplies grants immediately after the revoke loop, on the same principles: each
-- security-definer function is given to the only roles that should reach it. A later migration
-- that adds a function must repeat this loop, because its own CREATE would default EXECUTE to
-- PUBLIC again.
do $$
declare
   fn record;
   target_role text;
begin
   for fn in
      select
         n.nspname,
         p.proname,
         pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and p.prosecdef
   loop
      -- apply_plan_capabilities writes another user's capabilities, so it stays service_role.
      target_role := case when fn.proname = 'apply_plan_capabilities'
        then 'service_role' else 'authenticated' end;
      execute format(
         'grant execute on function %I.%I(%s) to %I',
         fn.nspname, fn.proname, fn.args, target_role
      );
   end loop;
end;
$$;

-- The invoker functions the client reads through (entitlement and usage) are not security
-- definers, but they still do not belong to anon. Revoke and regrant them explicitly rather
-- than relying on the loop above.
do $$
begin
   if to_regprocedure('public.my_entitlement()') is not null then
      revoke all on function public.my_entitlement() from public, anon;
      grant execute on function public.my_entitlement() to authenticated;
   end if;
   if to_regprocedure('public.my_model_usage()') is not null then
      revoke all on function public.my_model_usage() from public, anon;
      grant execute on function public.my_model_usage() to authenticated;
   end if;
end;
$$;