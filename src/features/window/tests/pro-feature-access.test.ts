import { describe, expect, it } from "vite-plus/test";
import type { AuthUser, SubscriptionInfo } from "../services/auth-api";
import { resolveProFeatureAccess } from "../hooks/use-pro-feature";

const proUser = { subscription_status: "free", subscriptionStatus: "pro" } satisfies Pick<
  AuthUser,
  "subscription_status" | "subscriptionStatus"
>;

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
  it("unlocks Pro surfaces from the camel-case API snapshot while details refresh", () => {
    expect(resolveProFeatureAccess(proUser, null)).toMatchObject({
      hasIntelligence: true,
      hasSettingsSync: true,
      hasCloudWorkspaces: true,
    });
  });

  it("keeps explicit server capabilities authoritative", () => {
    const access = resolveProFeatureAccess(
      proUser,
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

  it("treats Plus with a missing subscription as paid, not as free", () => {
    // The bug this guards: only "pro" was checked, so a Plus account whose subscription
    // object failed to load lost every paid capability until the next successful refresh.
    const plusUser = { subscription_status: "plus" } satisfies Pick<
      AuthUser,
      "subscription_status" | "subscriptionStatus"
    >;

    expect(resolveProFeatureAccess(plusUser, null)).toMatchObject({
      hasIntelligence: true,
      hasSettingsSync: true,
      hasCloudWorkspaces: true,
    });
  });

  it("keeps a Free account locked out when no subscription is loaded", () => {
    const freeUser = { subscription_status: "free" } satisfies Pick<
      AuthUser,
      "subscription_status" | "subscriptionStatus"
    >;

    // With no subscription object there is no capability snapshot at all, so nothing resolves.
    // That is the "data not loaded" state, not the free tier: `fetchSubscriptionStatus`
    // returns the free capability set for an account with no subscription row, which is what
    // gives a real free account hosted models and sync.
    expect(resolveProFeatureAccess(freeUser, null)).toMatchObject({
      hasIntelligence: false,
      hasCloudWorkspaces: false,
      hasHostedAi: false,
      hasSettingsSync: false,
    });
  });

  it("reads a loaded Plus subscription from its capabilities", () => {
    const access = resolveProFeatureAccess(
      null,
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
