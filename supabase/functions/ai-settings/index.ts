// AI model preferences: `defaultConnection`, per-task connections and `autoRouting`.
//
// This replaces `GET/PUT /api/account/intelligence`, which was served by the first-party host
// in `services.json` and stopped answering. The rest of the codebase still treats that host as
// authoritative for other account endpoints, so only this one feature moves: it is the one
// whose absence surfaces as "Sign in to sync your AI settings." for an account that is very
// much signed in.
//
// Writes go through `service_role` because the table exposes a read policy only. The user is
// still derived from the JWT on every call, so one account cannot address another's row.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * The scopes the app can ask for.
 *
 * Mirrors `personalScope` in the client store. Kept as data rather than implied by the absence
 * of a row so an unknown scope can be refused with 400 instead of quietly creating a row the
 * client will never read.
 */
const KNOWN_SCOPES = ["personal"] as const;

/** Refuse a write whose payload is far larger than anything the shape can produce. */
const MAX_PREFERENCES_BYTES = 32 * 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function anonClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

function scopesList() {
  return KNOWN_SCOPES.map((id) => ({ id, name: "Personal", canEdit: true }));
}

/** The response shape `fetchIntelligenceSettings` validates before trusting anything. */
function snapshot(scope: string, revision: number, preferences: unknown, updatedAt: string | null) {
  return {
    scope,
    scopes: scopesList(),
    preferences: preferences ?? {},
    revision,
    updatedAt,
  };
}

serve(async (req) => {
  const auth = anonClient(req);
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();

  // 401 rather than a body error: the client maps a missing session to its own message and
  // has no reason to distinguish "signed out" from "token rejected".
  if (authError || !user) return json({ error: "Not signed in." }, 401);

  const url = new URL(req.url);
  if (req.method !== "GET" && req.method !== "PUT") {
    return json({ error: "Method not allowed." }, 405);
  }

  let scope = url.searchParams.get("scope") ?? "personal";
  let revision: number | undefined;
  let preferences: unknown;

  if (req.method === "PUT") {
    const payload = (await req.json().catch(() => null)) as {
      scope?: unknown;
      revision?: unknown;
      preferences?: unknown;
    } | null;

    if (!payload) return json({ error: "Malformed request body." }, 400);
    if (typeof payload.scope === "string") scope = payload.scope;
    revision =
      typeof payload.revision === "number" && Number.isSafeInteger(payload.revision)
        ? payload.revision
        : undefined;
    preferences = payload.preferences;
  }

  if (!KNOWN_SCOPES.includes(scope as (typeof KNOWN_SCOPES)[number])) {
    return json({ error: `Unknown scope: ${scope}` }, 400);
  }

  if (req.method === "PUT") {
    if (revision === undefined) {
      return json({ error: "A numeric revision is required to save." }, 400);
    }
    if (!preferences || typeof preferences !== "object") {
      return json({ error: "Preferences must be an object." }, 400);
    }
    if (JSON.stringify(preferences).length > MAX_PREFERENCES_BYTES) {
      return json({ error: "Preferences are too large." }, 413);
    }
  }

  const db = serviceClient();
  const { data: row, error: readError } = await db
    .from("ai_settings")
    .select("revision, preferences, updated_at")
    .eq("user_id", user.id)
    .eq("scope", scope)
    .maybeSingle();

  if (readError) return json({ error: "Could not read AI settings." }, 502);

  if (req.method === "GET") {
    if (!row) return json(snapshot(scope, 0, {}, null), 200);
    return json(snapshot(scope, row.revision, row.preferences, row.updated_at), 200);
  }

  // PUT: refuse a write based on a revision the server has already moved past, so a second
  // device does not silently discard the first one's saved changes. The client surfaces this
  // as its existing "changed on another device" state.
  if (row && revision! < row.revision) {
    return json(
      {
        error: "Settings changed on another device. Reload saved settings to discard this device's draft.",
        revision: row.revision,
      },
      409,
    );
  }

  const nextRevision = (row?.revision ?? 0) + 1;
  const { error: writeError } = await db
    .from("ai_settings")
    .upsert(
      {
        user_id: user.id,
        scope,
        revision: nextRevision,
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,scope" },
    );

  if (writeError) return json({ error: "Could not save AI settings." }, 502);

  return json(snapshot(scope, nextRevision, preferences, new Date().toISOString()), 200);
});