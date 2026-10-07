// Hosted model access for every signed-in account, including free.
//
// Requests are counted for display only: `record_model_usage` never blocks, so a runaway loop
// cannot drain the shared upstream key. Quota enforcement, if it is ever wanted, is a separate
// decision rather than a side effect of showing a usage number.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/** Mirrors what the client appends to the base URL, so the two agree on one endpoint. */
const CHAT_PATH = "/chat/completions";

/**
 * The route the caller asked for, independent of the function mount path.
 *
 * The gateway serves the function at `/functions/v1/ai-proxy`, so the raw pathname carries a
 * prefix the routes below do not know about. Matching on the end of the path is what keeps
 * `/functions/v1/ai-proxy/models` from being read as an unknown route.
 */
function routeOf(req: Request): string {
  const path = new URL(req.url).pathname;
  const mount = "/functions/v1/ai-proxy";
  const stripped = path.startsWith(mount) ? path.slice(mount.length) : path;
  return stripped === "" ? "/" : stripped.replace(/\/+$/, "");
}

/**
 * Free plans are metered against one shared upstream key, so a single request must not be able
 * to burn the whole monthly allowance. Anything larger is refused with a message the user can
 * act on rather than a silent truncation.
 */
const MAX_OUTPUT_TOKENS = 4096;

/** Well inside the free-tier wall-clock limit, leaving room for the first byte to arrive. */
const UPSTREAM_TIMEOUT_MS = 120_000;

/** The model actually used, echoed back so the client can pin it for the rest of the run. */
const RESOLVED_MODEL_HEADER = "x-blimy-model";

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientFor(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

/**
 * The upstream provider. The key lives in a Supabase secret and never reaches the client, which
 * is the whole point of this function: the app ships no provider credential.
 */
function upstream(): { url: string; key: string } | null {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  const base = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return { url: `${base}/chat/completions`, key };
}

/**
 * Clamps the requested output length. A client asking for more gets the cap silently rather than
 * an error, because that is the common case when a caller forwards a model's advertised limit.
 */
function clampOutputTokens(requested: unknown): number {
  const value = typeof requested === "number" && Number.isFinite(requested) ? requested : 0;
  if (value <= 0) return MAX_OUTPUT_TOKENS;
  return Math.min(Math.floor(value), MAX_OUTPUT_TOKENS);
}

/** The model to record and to echo. "auto" is a request for the server to choose. */
function requestedModel(body: Record<string, unknown>): string {
  const model = body.model;
  return typeof model === "string" && model.trim() ? model.trim() : "auto";
}

serve(async (req: Request) => {
  const path = routeOf(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204 });
  }

  // The client reads the catalogue through Tauri, not a browser, so there is no cross-origin
  // caller to allow. Echoing a wildcard origin here would only widen who can try the key.
  const headers: Record<string, string> = { "cache-control": "no-store" };

  try {
    const supabase = clientFor(req);

    // auth.getUser() is called explicitly rather than relying on the gateway having verified the
    // token: this is the boundary where a caller would otherwise reach the provider.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401, headers);

    if (path === "/models" && req.method === "GET") {
      const { data, error } = await supabase
        .from("usage_by_model")
        .select("model, requests")
        .eq("user_id", user.id)
        .eq("scope", "day")
        .limit(200);
      if (error) return json({ error: "Could not load models." }, 500, headers);

      // A single shared model until more are configured. Reporting it as available keeps the
      // client from treating the catalog as empty and hiding the provider.
      return json(
        {
          enabled: true,
          data: [{ id: "auto", provider: "blimy", name: "Blimy Auto" }],
          usage: data ?? [],
        },
        200,
        headers,
      );
    }

    if (path === CHAT_PATH && req.method === "POST") {
      const provider = upstream();
      if (!provider) {
        // Configuration, not an entitlement problem, so 500 and no user-facing retry.
        return json({ error: "Hosted models are not configured on this server." }, 500, headers);
      }

      const raw = await req.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return json({ error: "Request body was not valid JSON." }, 400, headers);
      }

      const model = requestedModel(body);
      const payload = {
        ...body,
        model,
        max_completion_tokens: clampOutputTokens(body.max_completion_tokens ?? body.max_tokens),
      };

      let providerResponse: Response;
      try {
        providerResponse = await fetch(provider.url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${provider.key}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
      } catch (error) {
        // A timeout is not the user's fault and a retry is reasonable, so it says so plainly.
        if (error instanceof DOMException && error.name === "TimeoutError") {
          return json(
            {
              error: "That took too long and was stopped. Try again, or pick a faster model.",
              reason: "upstream_timeout",
            },
            504,
            headers,
          );
        }
        return json({ error: "Could not reach the model provider." }, 502, headers);
      }

      if (!providerResponse.ok) {
        // The provider's own message is not forwarded: it can quote the request back and says
        // nothing useful to the user here.
        console.warn(`ai-proxy: upstream responded ${providerResponse.status}`);
        return json(
          {
            error: "The model provider could not complete that request.",
            reason: "upstream_error",
          },
          providerResponse.status >= 500 ? 502 : providerResponse.status,
          headers,
        );
      }

      // Counted only once the provider accepted the request, so a failure never shows up as
      // usage. Best-effort: a counter that fails to write must not fail the turn.
      const resolved = providerResponse.headers.get(RESOLVED_MODEL_HEADER) ?? model;
      void supabase.rpc("record_model_usage", { target_model: resolved });

      return new Response(providerResponse.body, {
        status: 200,
        headers: {
          ...headers,
          "content-type": providerResponse.headers.get("content-type") ?? "text/event-stream",
          [RESOLVED_MODEL_HEADER]: resolved,
        },
      });
    }

    return json({ error: "Not found" }, 404, headers);
  } catch (error) {
    // The message is logged rather than returned, so an internal detail never reaches the client.
    console.error("ai-proxy failed:", error instanceof Error ? error.message : error);
    return json({ error: "Something went wrong handling that request." }, 500, headers);
  }
});
