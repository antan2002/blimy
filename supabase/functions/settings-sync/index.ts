// Settings snapshot sync.
//
// Replaces `GET/PUT /api/account/settings-sync`, which was served by the first-party host in
// `services.json` and stopped answering, so enabling cloud settings sync failed. One JSON
// snapshot per account; writes run as service_role and the user is derived from the JWT on
// every call, so one account cannot read or write another's snapshot.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/** A settings snapshot can legitimately be large; the client caps it far below this. */
const MAX_SETTINGS_BYTES = 1024 * 1024;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function anonClient(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

serve(async (req) => {
  const auth = anonClient(req);
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();

  if (authError || !user) return json({ error: "Not signed in." }, 401);
  if (req.method !== "GET" && req.method !== "PUT") {
    return json({ error: "Method not allowed." }, 405);
  }

  const db = serviceClient();
  const { data: row, error: readError } = await db
    .from("settings_sync")
    .select("schema_version, settings, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return json({ error: "Could not read settings sync." }, 502);

  if (req.method === "GET") {
    if (!row) return json({ snapshot: null }, 200);
    return json(
      {
        snapshot: {
          schemaVersion: row.schema_version,
          updatedAt: row.updated_at,
          settings: row.settings,
        },
      },
      200,
    );
  }

  // PUT
  const raw = await req.arrayBuffer();
  if (raw.byteLength === 0 || raw.byteLength > MAX_SETTINGS_BYTES) {
    return json({ error: "Malformed settings snapshot." }, 400);
  }
  let payload: { schemaVersion?: unknown; settings?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(raw)) as typeof payload;
  } catch {
    return json({ error: "Malformed settings snapshot." }, 400);
  }
  if (
    !Number.isSafeInteger(payload.schemaVersion) ||
    !payload.settings ||
    typeof payload.settings !== "object"
  ) {
    return json({ error: "A settings object and numeric schema version are required." }, 400);
  }

  const now = new Date().toISOString();
  const { error: writeError } = await db.from("settings_sync").upsert(
    {
      user_id: user.id,
      schema_version: payload.schemaVersion,
      settings: payload.settings,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (writeError) return json({ error: "Could not save settings sync." }, 502);

  return json(
    {
      snapshot: {
        schemaVersion: payload.schemaVersion,
        updatedAt: now,
        settings: payload.settings,
      },
    },
    200,
  );
});
