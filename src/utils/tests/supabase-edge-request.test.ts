import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { supabaseEdgeRequest } from "../supabase-edge-request";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  token: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/utils/tauri-fetch", () => ({ tauriFetch: state.fetch }));
vi.mock("@/utils/supabase-access-token", () => ({
  getAccessToken: state.token,
  refreshSupabaseSession: state.refresh,
}));
vi.mock("@/utils/api-base", () => ({ getEdgeFunctionsBase: () => "https://edge.test" }));

beforeEach(() => {
  state.fetch.mockReset();
  state.token.mockReset();
  state.refresh.mockReset();
});

describe("supabaseEdgeRequest", () => {
  it("returns 401 without calling the network when there is no token", async () => {
    state.token.mockResolvedValue(null);
    const result = await supabaseEdgeRequest("cloud-sessions");
    expect(result).toEqual({ ok: false, status: 401, body: { error: "Not signed in." } });
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("sends the live token and returns the body on success", async () => {
    state.token.mockResolvedValue("live");
    state.fetch.mockResolvedValue(Response.json({ pro: true }));
    const result = await supabaseEdgeRequest("cloud-sessions", { method: "GET" }, "/shares");
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer live");
    expect(result).toMatchObject({ ok: true, status: 200, body: { pro: true } });
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it("refreshes once and retries when the server answers 401", async () => {
    state.token.mockResolvedValue("stale");
    state.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ pro: true }));
    state.refresh.mockResolvedValue("fresh");
    const result = await supabaseEdgeRequest("cloud-sessions");
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(state.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh");
    expect(result).toMatchObject({ ok: true, status: 200, body: { pro: true } });
  });

  it("surfaces the 401 when a forced refresh cannot replace the token", async () => {
    state.token.mockResolvedValue("stale");
    state.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 }),
    );
    state.refresh.mockResolvedValue(null);
    const result = await supabaseEdgeRequest("cloud-sessions");
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, status: 401, body: { error: "Not signed in." } });
  });
});
