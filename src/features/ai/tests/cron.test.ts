import { describe, expect, it } from "vite-plus/test";
import { isCronExpression, nextCronRun, parseCron } from "@/features/ai/tools/cron";

/** Local-time construction: cron runs in the user's timezone, so tests must not assume UTC. */
const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

describe("cron parsing", () => {
  it("expands presets and five-field expressions", () => {
    expect(parseCron("@hourly").expression).toBe("0 * * * *");
    expect(parseCron("*/15 * * * *").minute.values).toEqual([0, 15, 30, 45]);
    expect(parseCron("0 9-11 * * *").hour.values).toEqual([9, 10, 11]);
    expect(parseCron("0 0 * jan-mar *").month.values).toEqual([1, 2, 3]);
    expect(parseCron("0 0 * * mon,fri").dayOfWeek.values).toEqual([1, 5]);
  });

  it("treats 7 as Sunday", () => {
    expect(parseCron("0 0 * * 7").dayOfWeek.values).toEqual([0]);
    expect(parseCron("0 0 * * 0,7").dayOfWeek.values).toEqual([0]);
  });

  it("rejects malformed expressions", () => {
    expect(isCronExpression("* * *")).toBe(false);
    expect(isCronExpression("60 * * * *")).toBe(false);
    expect(isCronExpression("0 0 0 * *")).toBe(false);
    expect(isCronExpression("*/0 * * * *")).toBe(false);
    expect(isCronExpression("0 0 * * funday")).toBe(false);
    expect(isCronExpression("0 0 * * *")).toBe(true);
  });
});

describe("cron next run", () => {
  it("finds the next matching minute", () => {
    const next = nextCronRun(parseCron("*/15 * * * *"), local(2026, 1, 1, 10, 7));
    expect(next).toEqual(local(2026, 1, 1, 10, 15));
  });

  it("skips to the next day when the hour has passed", () => {
    const next = nextCronRun(parseCron("30 9 * * *"), local(2026, 1, 1, 10, 0));
    expect(next).toEqual(local(2026, 1, 2, 9, 30));
  });

  it("jumps whole months for a monthly expression", () => {
    const next = nextCronRun(parseCron("0 0 1 * *"), local(2026, 1, 15, 0, 0));
    expect(next).toEqual(local(2026, 2, 1, 0, 0));
  });

  it("returns null when nothing matches within the search window", () => {
    expect(nextCronRun(parseCron("0 0 30 2 *"), local(2026, 1, 1, 0, 0))).toBeNull();
  });
});
