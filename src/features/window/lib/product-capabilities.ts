import type { ProductCapability, SubscriptionInfo } from "@/features/window/services/auth-api";

export function hasProductCapability(
  subscription: SubscriptionInfo | null,
  capability: ProductCapability,
): boolean {
  if (subscription?.capabilities) {
    return subscription.capabilities[capability];
  }

  if (capability === "collaboration") return Boolean(subscription?.collaboration?.enabled);
  if (capability === "enterprisePolicy") return subscription?.enterprise?.has_access === true;
  // A capabilities snapshot is authoritative when present. Without one, any status other than
  // "free" is treated as a paid tier: "pro" was the only paid status this app modelled.
  return subscription?.status !== undefined && subscription.status !== "free";
}

/**
 * Whether a subscription status names a paid tier.
 *
 * `plus` belongs here beside `pro`. Without it, a Plus account whose subscription object fails
 * to load has no status and no capabilities, and every capability resolves to false — so the
 * account drops to free behaviour for as long as that fetch is failing, silently losing the
 * cloud and paid-AI surfaces it paid for.
 */
export function isPaidTier(status: string | null | undefined): boolean {
  return status === "plus" || status === "pro";
}
