import { describe, expect, it } from "vitest";
import { getProjectNameFromPath, isRemoteProjectPath } from "../components/sidebar/project-glyph";

describe("activity project switcher", () => {
  it("uses the shared project path rules for local and remote projects", () => {
    expect(getProjectNameFromPath("/Users/mehmet/Git/blimy")).toBe("blimy");
    expect(getProjectNameFromPath("C:\\Users\\mehmet\\blimy")).toBe("blimy");
    expect(getProjectNameFromPath()).toBe("Open Project");
    expect(isRemoteProjectPath("remote://server/workspace")).toBe(true);
    expect(isRemoteProjectPath("/Users/mehmet/Git/blimy")).toBe(false);
  });
});
