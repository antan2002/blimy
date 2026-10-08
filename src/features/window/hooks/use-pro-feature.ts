import { useAuthStore } from "@/features/window/stores/auth.store";
import { hasProductCapability } from "@/features/window/lib/product-capabilities";
import type { SubscriptionInfo } from "@/features/window/services/auth-api";

export function resolveProFeatureAccess(
  subscription: SubscriptionInfo | null,
) {
  const hasHostedAi = hasProductCapability(subscription, "hostedAi");
  const hasIntelligence = hasProductCapability(subscription, "intelligence");
  const hasSettingsSync = hasProductCapability(subscription, "settingsSync");
  const hasCloudWorkspaces = hasProductCapability(subscription, "cloudWorkspaces");

  return {
    hasHostedAi,
    hasIntelligence,
    hasSettingsSync,
    hasCloudWorkspaces,
  };
}

export function useProFeature() {
  const subscription = useAuthStore((state) => state.subscription);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { hasHostedAi, hasIntelligence, hasSettingsSync, hasCloudWorkspaces } =
    resolveProFeatureAccess(subscription);
  const isPro = hasIntelligence;

  return {
    isPro,
    hasIntelligence,
    hasHostedAi,
    hasSettingsSync,
    hasCloudWorkspaces,
    isAuthenticated,
    subscriptionStatus: subscription?.status ?? "free",
  };
}
