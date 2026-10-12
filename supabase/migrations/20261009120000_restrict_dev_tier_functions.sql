-- Restrict the developer tier-switch functions to the service role.
--
-- dev_set_plan() and dev_entitlement() are SECURITY DEFINER functions that rewrite a
-- subscription (status, plan, capabilities, and quota history). They were granted to
-- `authenticated` in the plus/pro migration, guarded only by a hardcoded owner email
-- compared against the JWT's email claim. A JWT email is not an authorisation boundary:
-- an account signing in via a different provider, or any future custom-claim path, could
-- present a different address, and the guard would silently pass. A security-definer that
-- writes rows should only ever be reachable by the service role, never by a signed-in user.
--
-- The functions are intended for manual testing from the Supabase SQL editor, which runs
-- with the project's credentials, so nothing in the app itself calls them. Revoking the
-- `authenticated` grant removes the only client-reachable escalation path.

do $$
begin
   if to_regprocedure('public.dev_set_plan(text)') is not null then
      revoke all on function public.dev_set_plan(text) from public, anon, authenticated;
      grant execute on function public.dev_set_plan(text) to service_role;
   end if;

   if to_regprocedure('public.dev_entitlement()') is not null then
      revoke all on function public.dev_entitlement() from public, anon, authenticated;
      grant execute on function public.dev_entitlement() to service_role;
   end if;
end;
$$;