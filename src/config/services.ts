import SERVICE_DEFAULTS from "@/config/services.json";
import { getApiBase } from "@/utils/api-base";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getServiceUrls() {
  const apiBaseUrl = getApiBase();
  const websiteBaseUrl = trimTrailingSlash(
    import.meta.env.VITE_WEBSITE_URL?.trim() || SERVICE_DEFAULTS.websiteBaseUrl,
  );
  const extensionsCdnBaseUrl = trimTrailingSlash(
    import.meta.env.VITE_EXTENSIONS_CDN_URL?.trim() ||
      import.meta.env.VITE_PARSER_CDN_URL?.trim() ||
      SERVICE_DEFAULTS.extensionsCdnBaseUrl,
  );
  const updateBaseUrl = import.meta.env.VITE_UPDATE_BASE_URL?.trim();

  // A page URL uses its pinned value when the project configures one, and is
  // otherwise derived from the website base. Builds without a website leave
  // every page URL empty, which callers treat as "not available".
  const pageUrl = (pinned: string, ...segments: string[]) => {
    const configured = pinned.trim();
    if (configured) {
      return configured;
    }
    if (!websiteBaseUrl) {
      return "";
    }
    return `${websiteBaseUrl}/${segments.filter(Boolean).join("/")}`;
  };

  return {
    ...SERVICE_DEFAULTS,
    websiteBaseUrl,
    apiBaseUrl,
    docsUrl: pageUrl(SERVICE_DEFAULTS.docsUrl, "docs"),
    telemetryDocsUrl: pageUrl(SERVICE_DEFAULTS.telemetryDocsUrl, "docs", "telemetry"),
    pricingUrl: pageUrl(SERVICE_DEFAULTS.pricingUrl, "pricing"),
    dashboardUrl: pageUrl(SERVICE_DEFAULTS.dashboardUrl, "dashboard"),
    dashboardBillingUrl: pageUrl(SERVICE_DEFAULTS.dashboardBillingUrl, "dashboard", "settings", "billing"),
    dashboardIntegrationsUrl: pageUrl(
      SERVICE_DEFAULTS.dashboardIntegrationsUrl,
      "dashboard",
      "settings",
      "integrations",
    ),
    dashboardCollaborationUrl: pageUrl(
      SERVICE_DEFAULTS.dashboardCollaborationUrl,
      "dashboard",
      "collaboration",
    ),
    extensionsCdnBaseUrl,
    stableUpdateUrl: updateBaseUrl
      ? `${trimTrailingSlash(updateBaseUrl)}/api/update/stable`
      : SERVICE_DEFAULTS.stableUpdateUrl,
    previewUpdateUrl: updateBaseUrl
      ? `${trimTrailingSlash(updateBaseUrl)}/api/update/preview`
      : SERVICE_DEFAULTS.previewUpdateUrl,
  };
}
