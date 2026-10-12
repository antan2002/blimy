import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn() }));
vi.mock("@/utils/tauri-fetch", () => ({ tauriFetch: mocks.fetch }));
vi.mock("@/utils/supabase-access-token", () => ({
  getAccessToken: async () => "token",
  refreshSupabaseSession: mocks.refresh,
}));
vi.mock("@/utils/api-base", () => ({ getIntelligenceApiBase: () => "https://blimy.test" }));

import {
  IntelligenceWebError,
  fetchIntelligenceUrl,
  searchIntelligenceWeb,
} from "../intelligence/services/intelligence-web";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue("refreshed-token");
});

describe("searchIntelligenceWeb", () => {
  it("posts the query to the hosted search route and normalizes results", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({
        results: [
          {
            title: "Example headline",
            url: "https://example.com/story",
            publishedDate: "2026-10-10T00:00:00Z",
            snippet: "A highlighted excerpt.",
          },
        ],
      }),
    );

    const outcome = await searchIntelligenceWeb("latest Nvidia news");

    expect(mocks.fetch).toHaveBeenCalledWith("https://blimy.test/web/search", {
      signal: expect.any(AbortSignal),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify({ query: "latest Nvidia news" }),
    });
    expect(outcome.query).toBe("latest Nvidia news");
    expect(outcome.results).toEqual([
      {
        title: "Example headline",
        url: "https://example.com/story",
        publishedDate: "2026-10-10T00:00:00Z",
        snippet: "A highlighted excerpt.",
      },
    ]);
  });

  it("forwards maxResults when the agent asks for a bound", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ results: [] }));

    await searchIntelligenceWeb("docs", { maxResults: 5 });

    const [, init] = mocks.fetch.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: "docs",
      maxResults: 5,
    });
  });

  it("maps an upstream failure to a hosted error with the status", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "rate limited" }, 429));

    const error = await searchIntelligenceWeb("query").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(IntelligenceWebError);
    expect((error as IntelligenceWebError).status).toBe(429);
    expect((error as IntelligenceWebError).hosted).toBe(true);
    expect((error as IntelligenceWebError).message).toBe("rate limited");
  });

  it("tolerates an unreadable upstream body instead of crashing", async () => {
    mocks.fetch.mockResolvedValue(new Response("not json", { status: 200 }));

    const outcome = await searchIntelligenceWeb("query");

    expect(outcome.results).toEqual([]);
  });

  it("refreshes the session and retries once on a 401", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ title: "After refresh", url: "https://a.b", publishedDate: null, snippet: "" }] }),
      );

    const outcome = await searchIntelligenceWeb("query");

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const [initial, retried] = mocks.fetch.mock.calls;
    expect((initial[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer token" });
    expect((retried[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer refreshed-token",
    });
    expect(outcome.results).toHaveLength(1);
  });

  it("surfaces the 401 when a refresh produces no new token", async () => {
    mocks.refresh.mockResolvedValue(null);
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

    const error = await searchIntelligenceWeb("query").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(IntelligenceWebError);
    expect((error as IntelligenceWebError).status).toBe(401);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchIntelligenceUrl", () => {
  it("posts the url to the hosted fetch route", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ text: "Readable page text." }));

    const outcome = await fetchIntelligenceUrl("https://example.com/page");

    expect(mocks.fetch).toHaveBeenCalledWith("https://blimy.test/web/fetch", {
      signal: expect.any(AbortSignal),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify({ url: "https://example.com/page" }),
    });
    expect(outcome).toEqual({
      url: "https://example.com/page",
      text: "Readable page text.",
    });
  });

  it("maps an upstream failure to a hosted error", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "cannot read" }, 502));

    const error = await fetchIntelligenceUrl("https://example.com/page").catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(IntelligenceWebError);
    expect((error as IntelligenceWebError).status).toBe(502);
  });

  it("refreshes and retries fetch_url on a 401", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ text: "Read after refresh." }));

    const outcome = await fetchIntelligenceUrl("https://example.com/page");

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(outcome.text).toBe("Read after refresh.");
  });
});
