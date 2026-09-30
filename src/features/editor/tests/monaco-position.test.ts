import { describe, expect, it } from "vite-plus/test";
import { createBlimyModelUriParts, filePathFromBlimyModelUri } from "../engines/monaco/model-uri";

describe("Monaco model URIs", () => {
  it("keeps the internal buffer identity out of the visible file path", () => {
    const uri = createBlimyModelUriParts(
      "buffer__Users_blimydev_project_loading_tsx_1784828747746",
      "/Users/blimydev/project/src/components/loading.tsx",
    );

    expect(uri.path).toBe("/Users/blimydev/project/src/components/loading.tsx");
    expect(uri.query).toContain("buffer=");
    expect(uri.path).not.toContain("buffer_");
  });

  it("keeps models unique when the same path has multiple editor surfaces", () => {
    const first = createBlimyModelUriParts("buffer_first", "/workspace/src/file.ts");
    const second = createBlimyModelUriParts("buffer_second", "/workspace/src/file.ts");

    expect(first.path).toBe(second.path);
    expect(first.query).not.toBe(second.query);
  });

  it("uses a workspace-relative label without losing the real file path", () => {
    const uri = createBlimyModelUriParts(
      "buffer_loading",
      "/Users/blimydev/project/src/components/loading.tsx",
      "src/components/loading.tsx",
    );

    expect(uri.path).toBe("/src/components/loading.tsx");
    expect(filePathFromBlimyModelUri(uri.path, uri.query)).toBe(
      "/Users/blimydev/project/src/components/loading.tsx",
    );
  });

  it("recovers POSIX and Windows file paths from Blimy model URIs", () => {
    const posixUri = createBlimyModelUriParts("buffer_posix", "/workspace/src/file.ts");
    const windowsUri = createBlimyModelUriParts("buffer_windows", "C:/workspace/src/file.ts");

    expect(filePathFromBlimyModelUri(posixUri.path, posixUri.query)).toBe("/workspace/src/file.ts");
    expect(filePathFromBlimyModelUri(windowsUri.path, windowsUri.query)).toBe(
      "C:/workspace/src/file.ts",
    );
  });

  it("decodes escaped model paths", () => {
    expect(filePathFromBlimyModelUri("/workspace/my%20file.ts", "")).toBe("/workspace/my file.ts");
  });
});
