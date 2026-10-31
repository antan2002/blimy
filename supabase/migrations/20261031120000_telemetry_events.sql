-- Telemetry events
--
-- The app posts opt-in telemetry to `POST /api/telemetry/events` on the first-party host in
-- `services.json`. That host no longer answers, so an opted-in batch failed and stayed in the
-- local queue. This table is the Supabase home for those batches, written through the
-- `telemetry` edge function as service_role.
--
-- Telemetry is anonymous by design: a batch carries a random per-install device id, never an
-- account id. RLS is enabled with no policies, so only service_role reaches the table and
-- direct anonymous or user access stays off.

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  app_version text,
  platform text,
  arch text,
  event_id text not null,
  type text not null,
  occurred_at timestamp with time zone not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (device_id, event_id)
);

create index if not exists telemetry_events_received_at_idx
  on public.telemetry_events (received_at desc);

create index if not exists telemetry_events_type_idx
  on public.telemetry_events (type, received_at desc);

alter table public.telemetry_events enable row level security;

revoke all on public.telemetry_events from anon, authenticated;
