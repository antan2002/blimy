// Hosted model access for every signed-in account, including free.
//
// Three things happen here, in this order on the chat route: the model's plan tier is checked
// against the caller's subscription, quota is consumed through the safety RPCs, and the request
// is proxied to the upstream key. A turn that never reached the provider gives its quota back,
// so a failed request does not count against the user.
//
// Requests are counted for display only on the usage read: `record_model_usage` never blocks,
// so a runaway loop cannot drain the shared upstream key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/** Mirrors what the client appends to the base URL, so the two agree on one endpoint. */
const CHAT_PATH = "/chat/completions";

/** The hosted text-feature route: inline edits and commit titles share it. */
const TEXT_PATH = "/inline-edit";

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
  const stripped = path.startsWith(mount) ? path.slice(mount.length) : "";
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

/** The plan tier a model requires. Mirrors `ModelTier` on the client. */
type ModelTier = "free" | "plus" | "pro";

const TIER_RANK: Record<ModelTier, number> = { free: 0, plus: 1, pro: 2 };

/** A catalog row: what the client is told about one hosted model. */
interface CatalogEntry {
  id: string;
  name: string;
  tier: ModelTier;
  provider: "blimy";
  maxOutputTokens?: number;
  supportsImages?: boolean;
}

/**
 * The lineup this function serves when no override is configured. The split is the product
 * decision: Automatic is free, Claude/GPT/Gemini are pro, Kimi/GLM/DeepSeek are plus.
 */
const BUILT_IN_CATALOG: Omit<CatalogEntry, "provider">[] = [
  { id: "auto", name: "Automatic", tier: "free", maxOutputTokens: 32000, supportsImages: true },
  { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", tier: "pro", maxOutputTokens: 32000, supportsImages: true },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", tier: "pro", maxOutputTokens: 32000, supportsImages: true },
  { id: "openai/gpt-5.6-sol", name: "GPT 5.6 Sol", tier: "pro", maxOutputTokens: 32000, supportsImages: true },
  { id: "openai/gpt-5.3-codex", name: "GPT 5.3 Codex", tier: "pro", maxOutputTokens: 32000, supportsImages: true },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", tier: "pro", maxOutputTokens: 32000, supportsImages: true },
  { id: "moonshotai/kimi-k2.7-code", name: "Kimi K2.7 Code", tier: "plus", maxOutputTokens: 32000, supportsImages: true },
  { id: "zai/glm-5.3", name: "GLM 5.3", tier: "plus", maxOutputTokens: 32000, supportsImages: false },
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", tier: "plus", maxOutputTokens: 32000, supportsImages: false },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", tier: "plus", maxOutputTokens: 32000, supportsImages: false },
];

function isModelTier(value: unknown): value is ModelTier {
  return value === "free" || value === "plus" || value === "pro";
}

/**
 * The served lineup: the `BLIMY_MODEL_CATALOG` secret when it parses as an array, otherwise
 * the built-in list. A bad secret falls back instead of emptying the menu, because an
 * unparsable override is a configuration mistake, not a reason to hide every model.
 */
function modelCatalog(): CatalogEntry[] {
  const raw = Deno.env.get("BLIMY_MODEL_CATALOG");
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rows = parsed
          .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
          .filter((row) => typeof row.id === "string" && row.id.length > 0)
          .map((row) => ({
            id: row.id as string,
            name: typeof row.name === "string" && row.name ? row.name : (row.id as string),
            tier: isModelTier(row.tier) ? row.tier : "free",
            provider: "blimy" as const,
            ...(typeof row.maxOutputTokens === "number" ? { maxOutputTokens: row.maxOutputTokens } : {}),
            ...(typeof row.supportsImages === "boolean" ? { supportsImages: row.supportsImages } : {}),
          }));
        if (rows.length > 0) return rows;
      }
    } catch {
      // Fall through to the built-in lineup.
    }
  }
  return BUILT_IN_CATALOG.map((row) => ({ ...row, provider: "blimy" as const }));
}

/**
 * The tier a request needs. `auto` and an empty model are free, an id equal to the configured
 * default is free (the client pins that id for the rest of the run after `auto` resolves), a
 * catalog id takes its own tier, and an id the server does not know is treated as pro so a
 * hand-crafted request cannot slip past the split.
 */
function tierOfModel(requested: string, catalog: CatalogEntry[]): ModelTier {
  if (!requested || requested === "auto") return "free";
  const defaultModel = (Deno.env.get("BLIMY_DEFAULT_MODEL") ?? "").trim();
  if (defaultModel && requested === defaultModel) return "free";
  const entry = catalog.find((row) => row.id === requested);
  return entry ? entry.tier : "pro";
}

/**
 * The tier the caller's subscription grants. An unknown or missing status is free, so a
 * half-loaded account can never appear to own a paid tier.
 */
async function planTier(supabase: ReturnType<typeof clientFor>, userId: string): Promise<ModelTier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  const status = typeof data?.status === "string" ? data.status : "";
  return status === "plus" || status === "pro" ? status : "free";
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientFor(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
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
 * an error, because the common case is a caller forwarding a model's advertised limit.
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

/**
 * Turns a denial from `consume_request()` into the response the client can act on: quota
 * denials are 429 (retry later), a missing subscription is 402 (upgrade), and no sign-in is 401.
 * The reason travels in `reason`, which is the field the client maps to its messages.
 */
function consumeDenied(result: Record<string, unknown>, headers: Record<string, string>): Response {
  const reason = typeof result.reason === "string" ? result.reason : "quota";
  if (reason === "not_signed_in") return json({ error: "Unauthorized" }, 401, headers);
  if (reason === "no_subscription") {
    return json({ error: "This account has no active plan.", reason: "entitlement_required" }, 402, headers);
  }
  const message =
    reason === "minute_limit"
      ? "That is too many requests for one minute. Try again in a moment."
      : reason === "site_daily_limit"
        ? "Blimy hosted models are at today's shared limit. Try again later."
        : "This plan's request limit has been reached. It resets at the start of the next period.";
  return json(
    {
      error: message,
      reason,
      ...(typeof result.limit === "number" ? { limit: result.limit } : {}),
      ...(typeof result.used === "number" ? { used: result.used } : {}),
      ...(result.resets_at !== undefined ? { resets_at: result.resets_at } : {}),
    },
    429,
    headers,
  );
}

/** Rejects a request whose model needs a higher plan than the account holds. */
function tierGateResponse(
  requiredTier: ModelTier,
  plan: ModelTier,
  headers: Record<string, string>,
): Response | null {
  if (TIER_RANK[requiredTier] <= TIER_RANK[plan]) return null;
  return json(
    {
      error: "This model needs a higher plan. Upgrade to use it.",
      reason: "model_locked",
      requiredTier,
    },
    402,
    headers,
  );
}

/**
 * Runs the safety quota for a request. Returns the 401/402/429 response when the request must
 * not proceed, or null when it consumed a slot and can continue.
 */
async function consumeGate(
  supabase: ReturnType<typeof clientFor>,
  headers: Record<string, string>,
): Promise<Response | null> {
  const { data: consumed, error: consumeError } = await supabase.rpc("consume_request");
  if (consumeError || typeof consumed !== "object" || consumed === null) {
    return json({ error: "Could not verify the request allowance." }, 500, headers);
  }
  const decision = consumed as Record<string, unknown>;
  return decision.allowed === true ? null : consumeDenied(decision, headers);
}

/** The hosted text features the function serves, one prompt template each. */
const TEXT_INSTRUCTIONS: Record<string, string> = {
  "inline-edit":
    "Rewrite only the selected code. Return replacement code without markdown fences or explanations. Preserve the surrounding code.",
  "commit-message":
    "Write a Git commit message from the supplied staged diff. Follow the requested format and repository style. Return only the message.",
};

/** Trims a code fence the model wrapped around its answer. */
function cleanTextOutput(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1] : value;
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

    const catalog = modelCatalog();

    if (path === "/models" && req.method === "GET") {
      const { data, error } = await supabase
        .from("usage_by_model")
        .select("model, requests")
        .eq("user_id", user.id)
        .eq("scope", "day")
        .limit(200);
      if (error) return json({ error: "Could not load models." }, 500, headers);

      // The full lineup, tier included: every row is listed even when the caller's plan cannot
      // reach it, because the menu shows locked rows with an upgrade hint rather than hiding
      // models the user could upgrade into.
      return json(
        {
          enabled: true,
          data: catalog,
          usage: data ?? [],
        },
        200,
        headers,
      );
    }

    if (path === CHAT_PATH && req.method === "POST") {
      const raw = await req.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return json({ error: "Request body was not valid JSON." }, 400, headers);
      }

      const model = requestedModel(body);

      // The tier gate runs before quota: a locked model must not cost the caller a request
      // from their allowance while being refused.
      const plan = await planTier(supabase, user.id);
      const gated = tierGateResponse(tierOfModel(model, catalog), plan, headers);
      if (gated) return gated;

      const quotaDenied = await consumeGate(supabase, headers);
      if (quotaDenied) return quotaDenied;

      const provider = upstream();
      if (!provider) {
        // Configuration, not an entitlement problem, so 500 and no user-facing retry.
        void supabase.rpc("refund_request");
        return json({ error: "Hosted models are not configured on this server." }, 500, headers);
      }

      const resolvedModel =
        model === "auto" ? (Deno.env.get("BLIMY_DEFAULT_MODEL")?.trim() || "auto") : model;
      const payload = {
        ...body,
        model: resolvedModel,
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
        // The provider never answered, so the reserved request is given back before answering.
        await supabase.rpc("refund_request");
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
        await supabase.rpc("refund_request");
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
      const resolved =
        providerResponse.headers.get(RESOLVED_MODEL_HEADER) ?? resolvedModel;
      void supabase.rpc("record_model_usage", { target_model: resolved });

      return new Response(providerResponse.body, {
        status: 200,
        headers: {
          ...headers,
          "content-type":
            providerResponse.headers.get("content-type") ?? "text/event-stream",
          [RESOLVED_MODEL_HEADER]: resolved,
        },
      });
    }

    if (path === TEXT_PATH && req.method === "POST") {
      const raw = await req.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return json({ error: "Request body was not valid JSON." }, 400, headers);
      }

      // Only the two user-triggered features are served. Autocomplete is deliberately absent:
      // Tab fires on almost every pause and would burn the shared free-tier key in minutes, so
      // it stays on the user's own key or Ollama.
      const feature = typeof body.feature === "string" ? body.feature : "inline-edit";
      if (feature !== "inline-edit" && feature !== "commit-message") {
        return json(
          {
            error: "This AI feature is not available through blimy's hosted models. Add your own API key or use Ollama instead.",
            reason: "feature_unavailable",
          },
          400,
          headers,
        );
      }

      const model = requestedModel(body);
      const plan = await planTier(supabase, user.id);
      const gated = tierGateResponse(tierOfModel(model, catalog), plan, headers);
      if (gated) return gated;

      const quotaDenied = await consumeGate(supabase, headers);
      if (quotaDenied) return quotaDenied;

      const provider = upstream();
      if (!provider) {
        void supabase.rpc("refund_request");
        return json({ error: "Hosted models are not configured on this server." }, 500, headers);
      }

      const resolvedModel =
        model === "auto" ? (Deno.env.get("BLIMY_DEFAULT_MODEL")?.trim() || "auto") : model;
      const userContent = JSON.stringify({
        file: body.filePath,
        language: body.languageId,
        instruction: typeof body.instruction === "string" ? body.instruction : undefined,
        before: body.beforeSelection,
        selection: body.selectedText,
        after: body.afterSelection || "",
        ...(Array.isArray(body.recentEdits) && body.recentEdits.length > 0
          ? { recentEdits: body.recentEdits }
          : {}),
        ...(Array.isArray(body.diagnostics) && body.diagnostics.length > 0
          ? { diagnostics: body.diagnostics }
          : {}),
      });
      const payload = {
        model: resolvedModel,
        messages: [
          { role: "system", content: TEXT_INSTRUCTIONS[feature] },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_completion_tokens: clampOutputTokens(body.max_tokens),
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
        await supabase.rpc("refund_request");
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
        await supabase.rpc("refund_request");
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

      const upstreamBody = (await providerResponse.json().catch(() => null)) as
        | { choices?: { message?: { content?: unknown } }[] }
        | null;
      const content =
        typeof upstreamBody?.choices?.[0]?.message?.content === "string"
          ? upstreamBody.choices[0].message.content
          : "";
      void supabase.rpc("record_model_usage", { target_model: resolvedModel });

      return json({ editedText: cleanTextOutput(content) }, 200, headers);
    }

    return json({ error: "Not found" }, 404, headers);
  } catch (error) {
    // The message is logged rather than returned, so an internal detail never reaches the client.
    console.error("ai-proxy failed:", error instanceof Error ? error.message : error);
    return json({ error: "Something went wrong handling that request." }, 500, headers);
  }
});
