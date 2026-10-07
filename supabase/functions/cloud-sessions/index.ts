// Chat session backup and the wider share surface.
//
// This replaces `GET/POST /api/cloud-sessions` and `/api/shares`, which were served by the
// first-party host in `services.json` and stopped answering. The rest of the client keeps its
// routes (`/api/cloud-sessions`, `/api/shares`, `/api/shares/:id`) and just points them at
// this function, so the sharing UI and the session sync runtime did not need to change shape.
//
// Writes go through `service_role` for the same reason ai-settings does: the tables expose
// read-only policies and the user is still derived from the JWT on every call, so one account
// cannot address another's rows.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/** Largest payload the shape can legitimately produce; the client caps a session at 500k chars. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const SHARE_KINDS = ["snippet", "buffer", "agent"];
const SHARE_VISIBILITIES = ["private", "public", "email", "organization"];

const WEBSITE_BASE = Deno.env.get("BLIMY_WEBSITE_URL") ?? "";

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

/** Path segments after the function name, e.g. `["shares", "abc"]` or `["cloud-sessions"]`. */
function routePath(req: Request): string[] {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const at = segments.indexOf("cloud-sessions");
  return at === -1 ? [] : segments.slice(at + 1);
}

async function readBody(req: Request): Promise<Record<string, unknown> | undefined | null> {
  const raw = await req.arrayBuffer();
  if (raw.byteLength === 0) return undefined;
  if (raw.byteLength > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

type CloudSessionRow = {
  id: string;
  source_id: string | null;
  device_id: string;
  title: string;
  kind: string;
  visibility: string;
  live: boolean;
  content: string;
  language: string;
  messages: unknown;
  emails: unknown;
  workspace_id: number | null;
  revision: number;
  source_updated_at: number | null;
  updated_at: string;
};

/** The `ShareOptions` the client renders: sync config plus every item the account owns. */
async function buildOptions(db: ReturnType<typeof serviceClient>, userId: string) {
  const [{ data: config }, { data: sub }] = await Promise.all([
    db.from("cloud_sessions_config").select("*").eq("user_id", userId).maybeSingle(),
    db.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
  ]);

  let pro = false;
  if (sub?.status) {
    const { data: plan } = await db
      .from("plans")
      .select("capabilities")
      .eq("status", sub.status)
      .maybeSingle();
    pro = plan?.capabilities?.intelligence === true;
  }

  const { data: rows, error: readError } = await db
    .from("cloud_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (readError) return null;

  const items = (rows as CloudSessionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    visibility: row.visibility,
    live: row.live,
    sourceId: row.source_id,
    deviceId: row.device_id,
    revision: row.revision,
    updatedAt: new Date(row.updated_at).getTime(),
    emails: Array.isArray(row.emails) ? row.emails : [],
    workspaceId: row.workspace_id,
  }));

  return {
    pro,
    sessionsEnabled: config?.sessions_enabled === true,
    excludedSources: Array.isArray(config?.excluded_sources) ? config.excluded_sources : [],
    items,
    organizations: [],
  };
}

async function upsertPrivateSession(
  db: ReturnType<typeof serviceClient>,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const sourceId = asString(body.sourceId);
  const deviceId = asString(body.deviceId) ?? "";
  const kind = asString(body.kind);
  const title = asString(body.title) ?? "";
  const content = asString(body.content) ?? "";
  const language = asString(body.language) ?? "text";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const sourceUpdatedAt = typeof body.sourceUpdatedAt === "number" ? body.sourceUpdatedAt : null;

  if (!sourceId || !kind || !SHARE_KINDS.includes(kind)) {
    return json({ error: "A session source and kind are required." }, 400);
  }

  const { data: existing } = await db
    .from("cloud_sessions")
    .select("id, revision")
    .eq("user_id", userId)
    .eq("source_id", sourceId)
    .eq("device_id", deviceId)
    .maybeSingle();

  const base = {
    user_id: userId,
    source_id: sourceId,
    device_id: deviceId,
    kind,
    title,
    content,
    language,
    messages,
    live: body.live === true,
    visibility: "private",
    source_updated_at: sourceUpdatedAt,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const nextRevision = (existing.revision ?? 0) + 1;
    const { error } = await db
      .from("cloud_sessions")
      .update({ ...base, revision: nextRevision })
      .eq("id", existing.id);
    if (error) return json({ error: "Could not save the cloud session." }, 502);
    return json({ id: existing.id, revision: nextRevision }, 200);
  }

  const { data, error } = await db
    .from("cloud_sessions")
    .insert({ ...base, revision: 1 })
    .select("id")
    .single();
  if (error) return json({ error: "Could not save the cloud session." }, 502);
  return json({ id: data.id, revision: 1 }, 200);
}

serve(async (req) => {
  const auth = anonClient(req);
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();

  if (authError || !user) return json({ error: "Not signed in." }, 401);

  const db = serviceClient();
  const route = routePath(req);

  if (req.method === "GET") {
    const options = await buildOptions(db, user.id);
    if (!options) return json({ error: "Could not read cloud sessions." }, 502);
    return json(options, 200);
  }

  const body = await readBody(req);
  if (body === null) return json({ error: "Malformed request body." }, 400);
  const payload = body ?? {};

  if (req.method === "POST" && (route[0] === "cloud-sessions" || route.length === 0)) {
    return upsertPrivateSession(db, user.id, payload);
  }

  if (req.method === "PATCH" && (route[0] === "cloud-sessions" || route.length === 0)) {
    if (typeof payload.enabled !== "boolean") {
      return json({ error: "A boolean `enabled` is required." }, 400);
    }
    const { data: existing } = await db
      .from("cloud_sessions_config")
      .select("excluded_sources")
      .eq("user_id", user.id)
      .maybeSingle();
    const { error } = await db.from("cloud_sessions_config").upsert(
      {
        user_id: user.id,
        sessions_enabled: payload.enabled,
        excluded_sources: Array.isArray(existing?.excluded_sources)
          ? existing.excluded_sources
          : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return json({ error: "Could not update cloud session sync." }, 502);
    return json({ sessionsEnabled: payload.enabled }, 200);
  }

  if (req.method === "POST" && route[0] === "shares") {
    const kind = asString(payload.kind);
    const visibility = asString(payload.visibility);
    if (!kind || !SHARE_KINDS.includes(kind)) {
      return json({ error: "A share kind is required." }, 400);
    }
    const { data, error } = await db
      .from("cloud_sessions")
      .insert({
        user_id: user.id,
        source_id: asString(payload.sourceId) ?? null,
        device_id: asString(payload.deviceId) ?? "",
        kind,
        title: asString(payload.title) ?? "",
        content: asString(payload.content) ?? "",
        language: asString(payload.language) ?? "text",
        messages: Array.isArray(payload.messages) ? payload.messages : [],
        emails: Array.isArray(payload.emails) ? payload.emails : [],
        workspace_id: typeof payload.workspaceId === "number" ? payload.workspaceId : null,
        live: payload.live === true,
        visibility: visibility && SHARE_VISIBILITIES.includes(visibility) ? visibility : "public",
        source_updated_at:
          typeof payload.sourceUpdatedAt === "number" ? payload.sourceUpdatedAt : null,
        revision: 1,
      })
      .select("id")
      .single();
    if (error) return json({ error: "Could not create the share." }, 502);
    return json({ id: data.id, url: `${WEBSITE_BASE}/s/${data.id}` }, 200);
  }

  if (route[0] === "shares" && route[1]) {
    const id = route[1];

    if (req.method === "PATCH") {
      const { data: row, error: readError } = await db
        .from("cloud_sessions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (readError) return json({ error: "Could not update the share." }, 502);
      if (!row) return json({ error: "Shared item not found." }, 404);
      if (typeof payload.revision === "number" && payload.revision !== row.revision) {
        return json({ error: "Changed on another device." }, 409);
      }

      const patch: Record<string, unknown> = {
        revision: row.revision + 1,
        updated_at: new Date().toISOString(),
      };
      if ("live" in payload) patch.live = payload.live === true;
      if (typeof payload.title === "string") patch.title = payload.title;
      if (typeof payload.content === "string") patch.content = payload.content;
      if (typeof payload.language === "string") patch.language = payload.language;
      if (Array.isArray(payload.messages)) patch.messages = payload.messages;
      if (typeof payload.sourceUpdatedAt === "number")
        patch.source_updated_at = payload.sourceUpdatedAt;
      if (
        typeof payload.visibility === "string" &&
        SHARE_VISIBILITIES.includes(payload.visibility)
      ) {
        patch.visibility = payload.visibility;
      }

      const { error } = await db.from("cloud_sessions").update(patch).eq("id", id);
      if (error) return json({ error: "Could not update the share." }, 502);
      return json({ revision: patch.revision }, 200);
    }

    if (req.method === "DELETE") {
      const { error } = await db
        .from("cloud_sessions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) return json({ error: "Could not revoke the share." }, 502);
      return json({ revoked: true }, 200);
    }
  }

  return json({ error: "Not found" }, 404);
});
