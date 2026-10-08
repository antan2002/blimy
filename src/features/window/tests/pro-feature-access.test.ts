import { describe, expect, it } from "vite-plus/test";
import type { SubscriptionInfo } from "../services/auth-api";
import { resolveProFeatureAccess } from "../hooks/use-pro-feature";

function subscription(
  value: Pick<SubscriptionInfo, "status"> & Partial<SubscriptionInfo>,
): SubscriptionInfo {
  return {
    subscription: null,
    enterprise: { has_access: false, is_admin: false, policy: null },
    ...value,
  };
}

describe("Pro feature access", () => {
  it("keeps explicit server capabilities authoritative", () => {
    const access = resolveProFeatureAccess(
      subscription({
        status: "pro",
        capabilities: {
          intelligence: false,
          hostedAi: false,
          settingsSync: true,
          cloudWorkspaces: false,
          collaboration: false,
          enterprisePolicy: false,
        },
      }),
    );

    expect(access).toMatchObject({
      hasIntelligence: false,
      hasSettingsSync: true,
      hasCloudWorkspaces: false,
    });
  });

  it("reads a loaded Plus subscription from its capabilities", () => {
    const access = resolveProFeatureAccess(
      subscription({
        status: "plus",
        capabilities: {
          intelligence: true,
          hostedAi: true,
          settingsSync: true,
          cloudWorkspaces: true,
          collaboration: false,
          enterprisePolicy: false,
          ownModelsOnly: true,
        },
      }),
    );

    expect(access).toMatchObject({
      hasIntelligence: true,
      hasCloudWorkspaces: true,
    });
  });
});
