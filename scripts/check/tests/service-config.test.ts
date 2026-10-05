import { describe, expect, it } from "vitest";
import { getServiceConfigErrors, type Services } from "../service-config";

const services: Services = {
  websiteBaseUrl: "https://Blimy.dev",
  stableUpdateUrl: "https://Blimy.dev/api/releases/stable",
  previewUpdateUrl: "https://Blimy.dev/api/releases/preview",
};

function validInput() {
  return {
    services,
    stable: {
      app: { security: { csp: "default-src 'self' https://Blimy.dev" } },
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
});
