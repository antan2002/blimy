import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    // Authentication still has to be explicit: consume_request() resolves auth.uid() from
    // the caller's JWT, and an unauthenticated caller must not reach the provider.
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quota is checked and consumed in one transaction, so concurrent requests cannot
    // both read a pre-increment value and slip past the cap. An absent subscription
    // returns allowed:false rather than throwing, so a missing row reads as "not
    // entitled" instead of a 500.
    const { data: decision, error: quotaError } = await supabaseClient.rpc("consume_request");

    if (quotaError) {
      return new Response(
        JSON.stringify({ error: "Could not verify the subscription for this account." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!decision?.allowed) {
      // 429 rather than 402: the limit resets on its own schedule, so this is a rate
      // limit, not a payment problem. The payload carries the reason and reset date so
      // the client can say something more useful than "error".
      return new Response(
        JSON.stringify({
          error: decision?.reason === "daily_limit"
            ? "Daily allowance reached. It resets at midnight UTC."
            : "Monthly allowance reached. It resets on the first of the month.",
          reason: decision?.reason ?? "no_subscription",
          limit: decision?.limit ?? null,
          used: decision?.used ?? null,
          resets_at: decision?.resets_at ?? null,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(decision?.limit ?? ""),
            "X-RateLimit-Remaining": "0",
            ...(decision?.resets_at ? { "X-RateLimit-Reset": decision.resets_at } : {}),
          },
        },
      );
    }

    const body = await req.json();
    
    // Simple passthrough to OpenAI as an example
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("Server configuration error");

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return new Response(openAiRes.body, {
      status: openAiRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": openAiRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      // A rejected token is an auth failure, not a malformed request.
      status: error.message === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
