import type { SubscriptionInfo } from "@/features/window/services/auth-api";
import { hasProductCapability } from "@/features/window/lib/product-capabilities";

/**
 * Whether this account may run blimy-hosted models.
 *
 * Reads the `hostedAi` capability, which every tier including free has. `intelligence` means
 * "paid tier" and would exclude free users from the models they are entitled to.
 */
export function canUseHostedProvider(
  providerId: string,
  subscription: SubscriptionInfo | null,
): boolean {
  return providerId === "blimy" && hasProductCapability(subscription, "hostedAi");
}

export function canUseProviderWithoutApiKey(params: {
  providerId: string;
  subscription: SubscriptionInfo | null;
  hasStoredKey: boolean;
  requiresApiKey: boolean;
}): boolean {
  const { hasStoredKey, requiresApiKey } = params;
  if (params.providerId === "blimy") return params.subscription !== null;

  if (!requiresApiKey) {
    return true;
  }

  if (hasStoredKey) {
    return true;
  }

  return false;
}
