import { describe, expect, it } from "vitest";
import { getServiceConfigErrors, type Services } from "../service-config";

const services: Services = {
  websiteBaseUrl: "https://github.com/antan2002/blimy",
  stableUpdateUrl: "https://github.com/antan2002/blimy/api/releases/stable",
  previewUpdateUrl: "https://github.com/antan2002/blimy/api/releases/preview",
};

function validInput() {
  return {
    services,
    stable: {
      app: { security: { csp: "default-src 'self' https://github.com/antan2002/blimy" } },
      plugins: { updater: { endpoints: [services.stableUpdateUrl] } },
    },
    preview: {
      plugins: { updater: { endpoints: [services.previewUpdateUrl] } },
    },
    capability: {
      permissions: [{ allow: [{ url: `${services.websiteBaseUrl}/**` }] }],
    },
  };
}

describe("service configuration", () => {
  it("accepts matching HTTPS service configuration", () => {
    expect(getServiceConfigErrors(validInput())).toEqual([]);
  });

  it("reports mismatched updater and capability configuration", () => {
    const input = validInput();
    input.preview.plugins.updater.endpoints = ["https://example.com/preview"];
    input.capability.permissions = [];

    expect(getServiceConfigErrors(input)).toEqual([
      "Preview Tauri updater endpoint does not match src/config/services.json.",
      "Tauri capabilities do not allow the configured Blimy website origin.",
    ]);
  });

  it("rejects a configured service that is not a public HTTPS URL", () => {
    const input = validInput();
    input.services = { ...services, websiteBaseUrl: "http://example.com" };

    expect(getServiceConfigErrors(input)).toContain("websiteBaseUrl must be a public HTTPS URL.");
  });

  it("accepts a build with every hosted service switched off", () => {
    const input = validInput();
    input.services = { websiteBaseUrl: "", stableUpdateUrl: "", previewUpdateUrl: "" };
    input.stable.plugins = { updater: { endpoints: [] } };
    input.preview.plugins = { updater: { endpoints: [] } };
    input.capability = { permissions: [] };

    expect(getServiceConfigErrors(input)).toEqual([]);
  });

  it("still reports updater drift when both sides are switched off", () => {
    const input = validInput();
    input.services = { websiteBaseUrl: "", stableUpdateUrl: "", previewUpdateUrl: "" };
    input.stable.plugins = { updater: { endpoints: ["https://example.com/stable"] } };
    input.preview.plugins = { updater: { endpoints: [] } };
    input.capability = { permissions: [] };

    expect(getServiceConfigErrors(input)).toEqual([
      "Stable Tauri updater endpoint does not match src/config/services.json.",
    ]);
  });
});
