import { describe, expect, it } from "vitest";
import {
  getNewProjectPath,
  getProjectNameError,
  getStarterCommand,
  inferProjectNameFromRepositoryUrl,
} from "../lib/new-project-model";

describe("new project model", () => {
  it("validates portable project names", () => {
    expect(getProjectNameError("Blimy-app")).toBeNull();
    expect(getProjectNameError("../Blimy")).toBe(
      "Project names cannot contain path separators or reserved characters.",
    );
    expect(getProjectNameError("CON")).toBe(
      "Choose a project name that is supported on every platform.",
    );
    expect(getProjectNameError("Blimy.")).toBe("Project names cannot end with a period or space.");
  });

  it("infers project names from common repository URLs", () => {
    expect(inferProjectNameFromRepositoryUrl("https://github.com/antan2002/blimy.git")).toBe(
      "Blimy",
    );
    expect(inferProjectNameFromRepositoryUrl("git@github.com:antan2002/blimy.git")).toBe("Blimy");
    expect(inferProjectNameFromRepositoryUrl("https://example.com/my%20project/")).toBe(
      "my project",
    );
  });

  it("builds the destination path with the location separator", () => {
    expect(getNewProjectPath("/Users/Blimy User/Code", "Blimy")).toBe("/Users/Blimy User/Code/Blimy");
    expect(getNewProjectPath("C:\\Users\\Blimy User\\Code", "Blimy")).toBe(
      "C:\\Users\\Blimy User\\Code\\Blimy",
    );
  });

  it("builds fixed starter commands for the selected package manager", () => {
    expect(getStarterCommand("nextjs", "pnpm")).toContain("pnpm dlx create-next-app@latest .");
    expect(getStarterCommand("nextjs", "pnpm")).toContain("--use-pnpm");
    expect(getStarterCommand("vite-react", "bun")).toBe(
      "bun create vite@latest . --template react-ts && bun install",
    );
  });
});
