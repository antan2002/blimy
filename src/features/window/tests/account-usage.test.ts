import { describe, expect, it } from "vite-plus/test";
import type { SubscriptionInfo } from "@/features/window/services/auth-api";
import { getAccountPlanLabel } from "../lib/account-usage";

/** The shape `plans.capabilities` carries in the database. */
type Capabilities = NonNullable<SubscriptionInfo["capabilities"]>;

function subscription(
  status: SubscriptionInfo["status"],
  capabilities?: Capabilities,
  plan?: string,
): SubscriptionInfo {
  return {
    status,
    capabilities,
    subscription: plan ? { plan, renews_at: null, ends_at: null } : null,
    enterprise: { has_access: false, is_admin: false, policy: null },
  };
}

const PLUS: Capabilities = {
  intelligence: true,
  hostedAi: true,
  settingsSync: true,
  cloudWorkspaces: true,
  collaboration: false,
  enterprisePolicy: false,
  ownModelsOnly: true,
};

const PRO: Capabilities = {
  intelligence: true,
  hostedAi: true,
  settingsSync: true,
  cloudWorkspaces: true,
  collaboration: true,
  enterprisePolicy: true,
  ownModelsOnly: false,
};

const FREE: Capabilities = {
  intelligence: false,
  hostedAi: true,
  settingsSync: true,
  cloudWorkspaces: false,
  collaboration: false,
  enterprisePolicy: false,
  ownModelsOnly: true,
};

describe("account usage", () => {
  it("labels Intelligence subscribers as Pro without exposing internal usage", () => {
    expect(getAccountPlanLabel(subscription("pro"), true)).toBe("Pro");
  });

  it("names Plus separately from Pro, even though Plus has cloud access", () => {
    expect(getAccountPlanLabel(subscription("plus", PLUS), true)).toBe("Plus");
  });

  it("names Free for a signed-in user with hosted models but no paid capability", () => {
    expect(getAccountPlanLabel(subscription("free", FREE), true)).toBe("Free");
  });

  it("names a signed-out visitor Guest even when a snapshot is present", () => {
    expect(getAccountPlanLabel(subscription("free", FREE), false)).toBe("Guest");
    expect(getAccountPlanLabel(null, false)).toBe("Guest");
  });

  it("still labels a paid tier Pro when the snapshot carries no status", () => {
    // A legacy response with capabilities but no status: the paid capability is the only
    // signal, so it must not fall through to "Free".
    expect(getAccountPlanLabel(subscription("free", PRO), true)).not.toBe("Guest");
  });

  it("prefers the plan name over the tier name for teams and enterprise", () => {
    expect(getAccountPlanLabel(subscription("pro", PRO, "teams"), true)).toBe("Teams");
    expect(getAccountPlanLabel(subscription("pro", PRO, "enterprise"), true)).toBe("Enterprise");
  });
});
