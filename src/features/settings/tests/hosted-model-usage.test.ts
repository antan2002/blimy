import { describe, expect, it } from "vite-plus/test";
import {
  describeModelUsage,
  formatReset,
  type ModelUsageRow,
} from "../components/ai/hosted-model-usage-section";

function row(overrides: Partial<ModelUsageRow> = {}): ModelUsageRow {
  return {
    scope: "day",
    model: "auto",
    requests: 1,
    resets_at: "2026-11-01",
    daily_limit: 60,
    monthly_limit: 200,
    ...overrides,
  };
}

describe("hosted model usage", () => {
  it("reports used against the limit and when it resets", () => {
    const text = describeModelUsage(row({ requests: 142, daily_limit: 200 }));
    expect(text).toContain("142 requests");
    expect(text).toContain("of 200");
    expect(text).toContain("resets");
  });

  it("reads a single request in the singular", () => {
    expect(describeModelUsage(row({ requests: 1 }))).toContain("1 request of");
  });

  it("calls a zero or absent limit unlimited rather than showing zero remaining", () => {
    expect(describeModelUsage(row({ daily_limit: 0 }))).toContain("Unlimited");
    expect(describeModelUsage(row({ daily_limit: null }))).toContain("Unlimited");
  });

  it("uses the limit belonging to the row's own scope", () => {
    expect(
      describeModelUsage(row({ scope: "month", requests: 40, daily_limit: 60, monthly_limit: 0 })),
    ).toContain("Unlimited");
  });

  it("omits the reset when the server sent no date rather than printing Invalid Date", () => {
    const text = describeModelUsage(row({ resets_at: "", daily_limit: 200 }));
    expect(text).toContain("of 200");
    expect(text).not.toContain("resets");
    expect(formatReset("")).toBe("");
  });

  it("renders the reset in the viewer's own timezone", () => {
    // A UTC date rendered in UTC would read as midnight; local time is what the user means.
    const text = describeModelUsage(row({ resets_at: "2026-11-01" }));
    expect(text).toMatch(/resets \w{3} \d{1,2},/);
  });
});