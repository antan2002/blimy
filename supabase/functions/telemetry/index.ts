// Anonymous telemetry ingestion.
//
// Replaces `POST /api/telemetry/events`, which was served by the first-party host in
// `services.json` and stopped answering, so an opted-in batch failed and stayed in the local
// queue. A batch carries a random per-install device id, never an account id, so this function
// does not read a user from the JWT and runs with the gateway check off.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/** The client chunks at 50; a larger batch is not a request this endpoint made. */
const MAX_EVENTS = 50;
/** A full batch is well under this; the cap only bounds a hostile body. */
const MAX_BYTES = 512 * 1024;
const MAX_TEXT = 128;
const MAX_TYPE = 64;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

type Row = {
  device_id: string;
  app_version: string | null;
  platform: string | null;
  arch: string | null;
  event_id: string;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

function readRows(body: Record<string, unknown>): Row[] | null {
  const deviceId = text(body.device_id, MAX_TEXT);
  const events = body.events;
  if (!deviceId || !Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    return null;
  }

  const rows: Row[] = [];
  for (const value of events) {
    if (!value || typeof value !== "object") return null;
    const event = value as Record<string, unknown>;
    const id = text(event.id, MAX_TEXT);
    const type = text(event.type, MAX_TYPE);
    const occurredAt = text(event.occurred_at, 64);
    if (!id || !type || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return null;

    rows.push({
      device_id: deviceId,
      app_version: text(body.app_version, MAX_TEXT),
      platform: text(body.platform, 32),
      arch: text(body.arch, 32),
      event_id: id,
      type,
      occurred_at: occurredAt,
      payload:
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {},
    });
  }

  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "Batch too large." }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const rows = readRows(body);
  if (!rows) return json({ error: "Invalid telemetry batch." }, 400);

  const { error } = await serviceClient()
    .from("telemetry_events")
    .upsert(rows, { onConflict: "device_id,event_id", ignoreDuplicates: true });

  if (error) return json({ error: "Could not store telemetry." }, 502);

  return json({ accepted: rows.length }, 202);
});
