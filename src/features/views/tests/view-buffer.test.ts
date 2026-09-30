import { describe, expect, it } from "vitest";
import { getViewBufferPath } from "@/features/views/lib/view-buffer";

describe("view buffer paths", () => {
  it("keeps setup tabs project-scoped", () => {
    expect(getViewBufferPath("/projects/Blimy")).toBe("view://create/%2Fprojects%2FBlimy");
  });

  it("gives each saved view a stable tab path", () => {
    expect(getViewBufferPath("/projects/Blimy", "release-downloads")).toBe(
      "view://%2Fprojects%2FBlimy/release-downloads",
    );
  });
});
