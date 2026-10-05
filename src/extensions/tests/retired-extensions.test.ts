import { describe, expect, it } from "vite-plus/test";
import {
  filterRetiredExtensions,
  isRetiredExtensionId,
} from "@/extensions/registry/retired-extensions";

describe("retired extensions", () => {
  it("retires the marketplace Blimy theme pack", () => {
    expect(isRetiredExtensionId("blimy.theme.market")).toBe(true);
    expect(isRetiredExtensionId("blimy.theme.vercel")).toBe(false);
  });

  it("filters retired extensions from marketplace and installed extension lists", () => {
    expect(
      filterRetiredExtensions([
        { id: "blimy.theme.market", name: "Blimy Theme Pack" },
        { id: "blimy.theme.vercel", name: "Vercel Theme" },
      ]),
    ).toEqual([{ id: "blimy.theme.vercel", name: "Vercel Theme" }]);
  });
});
