import { useAuthStore } from "@/features/window/stores/auth.store";
import { hasProductCapability, isPaidTier } from "@/features/window/lib/product-capabilities";
import type { AuthUser, SubscriptionInfo } from "@/features/window/services/auth-api";

/**
 * Whether either spelling of the status field names a paid tier.
 *
 * The API returns `subscriptionStatus` while older payloads used `subscription_status`, and
 * the two are not always in step — the snapshot fixture has one at "free" and the other at
 * "pro". Reading them with `??` picks the first defined value and silently ignores a paid
 * status sitting in the second field, so both have to be checked independently.
 */
function hasPaidStatus(
  user: Pick<AuthUser, "subscription_status" | "subscriptionStatus"> | null,
): boolean {
  return isPaidTier(user?.subscription_status) || isPaidTier(user?.subscriptionStatus);
}

export function resolveProFeatureAccess(
  user: Pick<AuthUser, "subscription_status" | "subscriptionStatus"> | null,
  subscription: SubscriptionInfo | null,
) {
  // When the subscription object is missing the status on the user is the only signal left.
  // `plus` counts the same as `pro` here, or a Plus account that hits a failed refresh is
  // treated as free for as long as the refresh keeps failing.
  const hasPaidStatusSnapshot = subscription === null && hasPaidStatus(user);
  // `hostedAi` means this account may run blimy-hosted models. Free has it. `intelligence`
  // means paid tier and stays reserved for the features free must not reach.
  const hasHostedAi = hasPaidStatusSnapshot || hasProductCapability(subscription, "hostedAi");
  const hasIntelligence =
    hasPaidStatusSnapshot || hasProductCapability(subscription, "intelligence");
  const hasSettingsSync =
    hasPaidStatusSnapshot || hasProductCapability(subscription, "settingsSync");
  const hasCloudWorkspaces =
    hasPaidStatusSnapshot || hasProductCapability(subscription, "cloudWorkspaces");

  return {
    hasHostedAi,
    hasIntelligence,
    hasSettingsSync,
    hasCloudWorkspaces,
  };
}

export function useProFeature() {
  const user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { hasHostedAi, hasIntelligence, hasSettingsSync, hasCloudWorkspaces } =
    resolveProFeatureAccess(user, subscription);
  // Paid tier, not "has any account feature". `settingsSync` is deliberately absent: free
  // carries it too, so including it here marked every signed-in free account as paid and
  // offered it "Manage Plan" where it should see "Upgrade". When the subscription is loaded
  // its capabilities decide; when it is missing, the status on the user is the fallback.
  const isPro = subscription === null ? hasPaidStatus(user) : hasIntelligence;

  return {
    isPro,
    // Both are separate on purpose: free accounts reach hosted models but not paid features.
    hasIntelligence,
    hasHostedAi,
    hasSettingsSync,
    hasCloudWorkspaces,
    isAuthenticated,
    subscriptionStatus:
      subscription?.status ?? user?.subscription_status ?? user?.subscriptionStatus ?? "free",
  };
}
