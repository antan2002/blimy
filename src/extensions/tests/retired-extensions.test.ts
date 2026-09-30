import { describe, expect, it } from "vite-plus/test";
import {
  filterRetiredExtensions,
  isRetiredExtensionId,
} from "@/extensions/registry/retired-extensions";

describe("retired extensions", () => {
  it("retires the marketplace Blimy theme pack", () => {
    expect(isRetiredExtensionId("Blimy.theme.market")).toBe(true);
    expect(isRetiredExtensionId("Blimy.theme.vercel")).toBe(false);
  });

  it("filters retired extensions from marketplace and installed extension lists", () => {
    expect(
      filterRetiredExtensions([
        { id: "Blimy.theme.market", name: "Blimy Theme Pack" },
        { id: "Blimy.theme.vercel", name: "Vercel Theme" },
      ]),
    ).toEqual([{ id: "Blimy.theme.vercel", name: "Vercel Theme" }]);
  });
});
