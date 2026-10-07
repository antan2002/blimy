import { describe, expect, it } from "vite-plus/test";
import {
  canUseHostedProvider,
  canUseProviderWithoutApiKey,
} from "@/features/ai/lib/provider-access";
import type { SubscriptionInfo } from "@/features/window/services/auth-api";

const subscription: SubscriptionInfo = {
  status: "pro",
  subscription: { plan: "pro", renews_at: null, ends_at: null },
  capabilities: {
    intelligence: true,
    hostedAi: true,
    settingsSync: true,
    cloudWorkspaces: true,
    collaboration: true,
    enterprisePolicy: false,
  },
  enterprise: { has_access: false, is_admin: false, policy: null },
};

describe("provider access", () => {
  it("allows signed-in free users to access the prepaid Blimy provider", () => {
    expect(
      canUseProviderWithoutApiKey({
        providerId: "blimy",
        subscription: {
          ...subscription,
          status: "free",
          capabilities: { ...subscription.capabilities!, intelligence: false },
        },
        hasStoredKey: false,
        requiresApiKey: false,
      }),
    ).toBe(true);
    expect(
      canUseProviderWithoutApiKey({
        providerId: "blimy",
        subscription: null,
        hasStoredKey: false,
        requiresApiKey: false,
      }),
    ).toBe(false);
  });

  it("keeps managed Intelligence separate from personal provider keys", () => {
    expect(canUseHostedProvider("blimy", subscription)).toBe(true);
    expect(canUseHostedProvider("openrouter", subscription)).toBe(false);
    expect(canUseHostedProvider("anthropic", subscription)).toBe(false);
  });

  it("gives a free account hosted models without unlocking paid-tier features", () => {
    const free = {
      ...subscription,
      status: "free" as const,
      capabilities: {
        ...subscription.capabilities!,
        intelligence: false,
        hostedAi: true,
        cloudWorkspaces: false,
        collaboration: false,
      },
    };

    expect(canUseHostedProvider("blimy", free), "free reaches Blimy models").toBe(true);
    expect(free.capabilities!.cloudWorkspaces, "cloud workspaces stay behind a paid tier").toBe(
      false,
    );
    expect(free.capabilities!.collaboration, "collaboration stays behind a paid tier").toBe(false);
  });

  it("withholds hosted models from an account with no subscription", () => {
    expect(canUseHostedProvider("blimy", null)).toBe(false);
  });

  it("does not treat Pro as a provider credential for Blimy Agent", () => {
    expect(
      canUseProviderWithoutApiKey({
        providerId: "openrouter",
        subscription,
        hasStoredKey: false,
        requiresApiKey: true,
      }),
    ).toBe(false);
  });
});
