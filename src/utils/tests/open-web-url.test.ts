import { describe, expect, it } from "vite-plus/test";
import { isOpenableWebUrl } from "@/utils/open-web-url";

describe("isOpenableWebUrl", () => {
  it("accepts absolute web urls", () => {
    expect(isOpenableWebUrl("https://example.com")).toBe(true);
    expect(isOpenableWebUrl("http://localhost:3000/app")).toBe(true);
    expect(isOpenableWebUrl("http://127.0.0.1:5173")).toBe(true);
  });

  it("rejects local files and custom schemes", () => {
    expect(isOpenableWebUrl("file:///etc/passwd")).toBe(false);
    expect(isOpenableWebUrl("file:///C:/Users/me/.ssh/id_rsa")).toBe(false);
    expect(isOpenableWebUrl("data:text/html,<h1>hi</h1>")).toBe(false);
    expect(isOpenableWebUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableWebUrl("mailto:someone@example.com")).toBe(false);
  });

  it("rejects empty and relative values", () => {
    expect(isOpenableWebUrl("")).toBe(false);
    expect(isOpenableWebUrl("   ")).toBe(false);
    expect(isOpenableWebUrl("/local/page.html")).toBe(false);
    expect(isOpenableWebUrl("example.com")).toBe(false);
  });
});
