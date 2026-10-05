# Plans, quotas and tiers

How entitlement works for hosted AI in Blimy, and how to test every tier without a payment
provider.

## The three tiers

| Tier | Own AI models | Quota | Resets | Cloud | Collaboration |
|---|---|---|---|---|---|
| `free` | yes | 500 requests | first of the month | no | no |
| `plus` | yes | 200 requests | midnight UTC, daily | yes | no |
| `pro` | yes, plus everything else | unlimited | never | yes | yes |

A new signup lands on `free` automatically. The `on_auth_user_created` trigger creates the
subscription row and `ensure_free_subscription()` is the idempotent backstop the app calls
on the first authenticated request.

`plus` is the odd one out on purpose: it is the only tier with a *daily* ceiling. That suits
heavy daily use without locking someone out for a whole month, and it makes the limit
visible within one session, which a monthly cap never is.

## Why `status` is the source of truth

`subscriptions.status` decides the entitlement. `subscriptions.capabilities` is a JSON
snapshot derived from it, kept only so the client can read the whole thing in one query
without joining `plans`.

The snapshot is written by `apply_plan_capabilities()`, never by hand. That is what stops
the two from drifting into a state where a user is `pro` but the client has been told
`ownModelsOnly: true`.

## Quota mechanics

Two counters per user, in `usage_counters`:

| `scope` | `period` | Applies to |
|---|---|---|
| `month` | first of the month | `free` (500) |
| `day` | today, UTC | `plus` (200) |
| — | — | `pro` writes no rows at all |

`consume_request()` checks and increments in one transaction, so two concurrent requests
cannot both read a pre-increment value and slip past the cap. Periods come from server-side
`now()`, so a client cannot backdate its way to a fresh counter.

When a cap is hit it returns the reason, the limit, current usage, and the reset date, so
the app can show something more useful than "error":

```json
{ "allowed": false, "reason": "daily_limit", "limit": 200, "used": 200,
  "resets_at": "2026-10-06" }
```

`my_entitlement()` returns the same numbers without consuming anything — use it for a usage
meter or a pricing screen.

## Reading entitlement in the client

```ts
const { data } = await supabase.rpc("my_entitlement");
// status, plan, capabilities, monthly_requests, daily_requests, monthly_used, daily_used
```

## Consuming quota

Call `consume_request()` before proxying to a provider. On `allowed: false` return the
information to the client rather than a bare 402:

```ts
const { data } = await supabase.rpc("consume_request");
if (!data.allowed) return json(data, 429);
```

Use **429**, not 402. 402 means "payment required", which is true for a tier problem but
wrong for a rate limit that resets on its own. The distinction matters for client retry
behaviour and for anyone reading logs later.

## Testing every tier

`dev_set_plan()` moves the owner's own account between tiers and clears the counters so a
new period starts immediately. No service-role client and no payment provider needed.

```sql
-- as the signed-in owner
select public.dev_set_plan('plus');
select * from public.dev_entitlement;
```

Then restart the app so `auth.store` re-reads the subscription. The plan is cached in the
keychain-backed session for the life of the sign-in.

Guarded on the project owner's address. **Delete
`20261003234400_dev_tier_switch.sql` before shipping** — it is a privilege escalation by
design, and the guard is an email comparison, not an authorisation system.

### To test a limit actually tripping

`plus` at 200/day is awkward to reach by hand. Temporarily drop it in the `plans` table:

```sql
update public.plans set daily_requests = 3 where status = 'plus';
```

Send four requests, watch the fourth return `daily_limit`. Then verify the reset:

```sql
-- force tomorrow's counter without waiting for midnight
insert into public.usage_counters (user_id, scope, period, requests)
select user_id, 'day', (timezone('utc'::text, now())::date + 1), 0
from auth.users where email = 'antanroy502@gmail.com'
on conflict do nothing;
```

Set it back to 200 afterwards.

## What is not built yet

- **Payments.** No Stripe. `blimy.dev` does not resolve, and `logoutFromServer()` calls
  `/api/auth/logout` on that host, so sign-out does not revoke the refresh token yet.
  Tiers currently change only through `dev_set_plan()`.
- **Warnings before the cap.** Nothing tells a user they are 80% through their month. The
  counters make this cheap to add; it needs a client decision on where it surfaces.
- **Rate-limit scope is requests, not tokens.** A very long conversation costs one request.
  That is simple and predictable, and it is abusable by sending a 500k-token prompt. Worth
  revisiting once there is a billing relationship to protect.