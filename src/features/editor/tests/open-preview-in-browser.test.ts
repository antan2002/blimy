import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  isBrowserPreviewableFile,
  openPreviewInBrowser,
  toFileUrl,
} from "@/features/editor/utils/open-preview-in-browser";

const mocks = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock("@tauri-apps/plugin-shell", () => ({ open: mocks.open }));

describe("toFileUrl", () => {
  it("builds a file url from a windows path, encoding spaces", () => {
    expect(toFileUrl("C:\\Users\\ada\\my page\\index.html")).toBe(
      "file:///C:/Users/ada/my%20page/index.html",
    );
  });

  it("builds a file url from a posix path", () => {
    expect(toFileUrl("/home/ada/notes.md")).toBe("file:///home/ada/notes.md");
  });

  it("returns null for missing and virtual paths", () => {
    expect(toFileUrl(null)).toBeNull();
    expect(toFileUrl("")).toBeNull();
    expect(toFileUrl("remote://server/project/index.html")).toBeNull();
    expect(toFileUrl("wsl://Ubuntu/home/ada/index.html")).toBeNull();
  });
});

describe("isBrowserPreviewableFile", () => {
  it("accepts html and htm files regardless of case", () => {
    expect(isBrowserPreviewableFile("/workspace/index.html")).toBe(true);
    expect(isBrowserPreviewableFile("/workspace/PAGE.HTM")).toBe(true);
  });

  it("rejects source files and missing paths", () => {
    expect(isBrowserPreviewableFile("/workspace/app.tsx")).toBe(false);
    expect(isBrowserPreviewableFile("/workspace/readme.md")).toBe(false);
    expect(isBrowserPreviewableFile(null)).toBe(false);
    expect(isBrowserPreviewableFile("")).toBe(false);
  });
});

describe("openPreviewInBrowser", () => {
  beforeEach(() => mocks.open.mockReset());

  it("opens an html file url in the system browser", async () => {
    mocks.open.mockResolvedValue(undefined);
    await expect(openPreviewInBrowser("/home/ada/index.html")).resolves.toBe(true);
    expect(mocks.open).toHaveBeenCalledWith("file:///home/ada/index.html");
  });

  it("does not hand non-html files to the OS", async () => {
    await expect(openPreviewInBrowser("/home/ada/app.tsx")).resolves.toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("does nothing when the path has no browser address", async () => {
    await expect(openPreviewInBrowser("remote://server/index.html")).resolves.toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
