import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { getApiErrorCode } from "../lib/api-error";
import { BlimyProvider } from "../services/providers/blimy-provider";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  plan: "free" as "pro" | "free",
}));
vi.mock("@/utils/tauri-fetch", () => ({ tauriFetch: state.fetch }));
vi.mock("@/utils/supabase-access-token", () => ({
  getSupabaseAccessToken: async () => "token",
}));
vi.mock("@/utils/api-base", () => ({ getIntelligenceApiBase: () => "https://api.test" }));
vi.mock("@/features/window/stores/auth.store", () => ({
  useAuthStore: { getState: () => ({ user: { id: 1 }, subscription: { status: state.plan } }) },
}));
vi.mock("@/features/ai/intelligence/stores/intelligence-settings.store", () => ({
  useIntelligenceSettingsStore: { getState: () => ({ scope: "personal" }) },
}));

const provider = () =>
  new BlimyProvider({
    id: "blimy",
    name: "Blimy",
    apiUrl: "",
    requiresApiKey: false,
    models: [],
  } as never);

beforeEach(() => {
  state.fetch.mockReset();
  state.plan = "free";
});

describe("Blimy hosted models", () => {
  it("reports a server-side switch-off rather than an upgrade prompt", async () => {
    // Every signed-in tier reaches hosted models, so an empty catalogue is never an entitlement
    // problem and must not be reported as one.
    state.fetch.mockResolvedValue(Response.json({ enabled: false, data: [] }));
    await expect(provider().getModels()).rejects.toThrow("not available on this server");
  });

  it("returns the catalogue the server sends", async () => {
    state.fetch.mockResolvedValue(
      Response.json({ enabled: true, data: [{ id: "auto", provider: "blimy", name: "Blimy Auto" }] }),
    );
    const models = await provider().getModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("auto");
    expect(getApiErrorCode(new Error("unrelated"))).not.toBe("402");
  });

  it("asks for the model's own output limit instead of a fixed 4096", () => {
    const request = {
      modelId: "anthropic/claude-sonnet-5",
      messages: [],
      maxTokens: 32000,
      temperature: 0.2,
    } as never;
    expect(provider().buildPayload(request)).toMatchObject({ max_completion_tokens: 32000 });
    expect(
      provider().buildPayload({ ...(request as object), maxTokens: Number.NaN } as never),
    ).not.toHaveProperty("max_completion_tokens");
  });
});
