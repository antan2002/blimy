import type { SubscriptionInfo } from "@/features/window/services/auth-api";
import { hasProductCapability } from "@/features/window/lib/product-capabilities";

export function getAccountPlanLabel(
  subscription: SubscriptionInfo | null,
  isAuthenticated: boolean,
): string {
  const isEnterprise = subscription?.subscription?.plan === "enterprise";
  const isTeams = subscription?.subscription?.plan === "teams";
  const status = subscription?.status;

  if (isEnterprise) return "Enterprise";
  if (isTeams) return "Teams";
  // Read the status first: `plus` is a paid tier with cloud access but not the Pro label,
  // so asking `intelligence` alone would call it "Pro".
  if (status === "free") return isAuthenticated ? "Free" : "Guest";
  if (status === "plus") return "Plus";
  if (status === "pro") return "Pro";
  // No status at all, but a paid capability present: a legacy snapshot with no tier name.
  if (hasProductCapability(subscription, "intelligence")) return "Pro";
  return isAuthenticated ? "Free" : "Guest";
}
