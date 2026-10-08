import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getServiceUrls } from "@/config/services";
import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import { useAIModelOptions } from "@/features/ai/hooks/use-ai-model-options";
import { useAvailableProviders } from "@/features/ai/hooks/use-available-providers";
import { formatTokenCount } from "@/features/ai/lib/acp-usage";
import { getHostedModelPriceHint } from "@/features/ai/lib/hosted-usage";
import {
  getModelIconId,
  getModelVendorName,
  pickRecommendedModels,
} from "@/features/ai/lib/model-vendor";
import { LOCKED_MODEL_HINT, isModelLocked, planTierOf } from "@/features/ai/lib/model-tier";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { useProFeature } from "@/features/window/hooks/use-pro-feature";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/ui/dropdown";
import { ArrowClockwiseIcon, LockIcon, SparkleIcon, WarningIcon } from "@/ui/icons";
import type { MenuSearch } from "@/ui/menu-search";
import { Spinner } from "@/ui/spinner";

const ModelResultsContext = createContext<((id: string, count: number) => void) | null>(null);

/**
 * Collects how many rows each section shows while the user searches, so a menu can say
 * "No matching models" once every section comes up empty. Wrap the sections in
 * `ModelResultsProvider` with the returned `reportResults`.
 */
export function useModelSearchResults() {
  const [resultCounts, setResultCounts] = useState<Record<string, number>>({});
  const reportResults = useCallback((id: string, count: number) => {
    setResultCounts((previous) =>
      previous[id] === count ? previous : { ...previous, [id]: count },
    );
  }, []);
  return {
    reportResults,
    hasNoResults: Object.values(resultCounts).every((count) => count === 0),
  };
}

export const ModelResultsProvider = ModelResultsContext;

/**
 * The providers a model menu offers besides blimy: every one the user connected, plus the one
 * currently selected so an existing choice never disappears from its own menu.
 */
export function useConnectedModelProviders(selectedProviderIds: string[] = []) {
  const providers = useAvailableProviders();
  const providerKeys = useAIChatStore((state) => state.providerApiKeys);
  return providers.filter(
    (provider) =>
      provider.id !== "blimy" &&
      (selectedProviderIds.includes(provider.id) || providerKeys.get(provider.id)),
  );
}

/** A model's display name, from the fetched catalog first and the static list second. */
export function useModelName(providerId: string, modelId: string) {
  const providers = useAvailableProviders();
  const dynamicModels = useAIChatStore((state) => state.dynamicModels);
  return (
    dynamicModels[providerId]?.find((model) => model.id === modelId)?.name ??
    providers
      .find((provider) => provider.id === providerId)
      ?.models.find((model) => model.id === modelId)?.name ??
    null
  );
}

export interface ModelOption {
  id: string;
  name: string;
  keywords?: string[];
  /** Vendor, price and context details, shown only in the row's tooltip. */
  tooltip?: string;
  /** Overrides the icon derived from the section's provider and the model id. */
  iconId?: string;
  iconUrl?: string | null;
  disabled?: boolean;
  /**
   * The row belongs to a higher plan. It stays clickable so it can offer the upgrade page,
   * instead of being `disabled` (which the menu renders pointer-events-none).
   */
  locked?: boolean;
}

interface ModelSectionProps {
  /** Unique within one menu; keys the section's search result count. */
  id: string;
  label: string;
  models: ModelOption[];
  selected: string;
  onSelect: (id: string) => void;
  /** Icon fallback for rows whose id names no known vendor. */
  providerId: string;
  search: MenuSearch;
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  disabled?: boolean;
}

function joinTooltip(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" Â· ");
}

/**
 * One headed group of model rows. It hides itself when it has nothing to show, and while the
 * user searches it keeps only the rows that match, or every row when its own name matches.
 */
export function ModelSection({
  id,
  label,
  models,
  selected,
  onSelect,
  providerId,
  search,
  loading,
  error,
  retry,
  disabled,
}: ModelSectionProps) {
  const filtered = search.filter(models, (model) => [
    model.name,
    model.id,
    label,
    ...(model.keywords ?? []),
  ]);
  const showStatus =
    Boolean(loading || error) &&
    (!search.isSearching || search.filter([label], (name) => [name]).length > 0);
  const count = filtered.length + (showStatus ? 1 : 0);
  const reportResults = useContext(ModelResultsContext);
  useEffect(() => {
    reportResults?.(id, count);
    return () => reportResults?.(id, 0);
  }, [count, id, reportResults]);

  if (count === 0) return null;

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {showStatus && loading ? (
        <DropdownMenuItem disabled>
          <Spinner label={`Loading ${label} models`} compact />
          Loading...
        </DropdownMenuItem>
      ) : null}
      {showStatus && !loading && error ? (
        <DropdownMenuItem
          closeOnClick={false}
          onClick={retry}
          disabled={!retry}
          title={error}
          aria-label={retry ? `${error} Retry` : error}
        >
          <WarningIcon />
          <span className="min-w-0 flex-1 truncate">{error}</span>
          {retry ? <ArrowClockwiseIcon /> : null}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuRadioGroup value={selected} onValueChange={onSelect}>
        {filtered.map((model) =>
          model.locked ? (
            <DropdownMenuItem
              key={model.id}
              closeOnClick={false}
              disabled={disabled}
              onClick={() => void openUrl(getServiceUrls().pricingUrl)}
              title={LOCKED_MODEL_HINT}
              aria-label={`${model.name}. ${LOCKED_MODEL_HINT}`}
            >
              <ProviderIcon
                providerId={model.iconId ?? getModelIconId(providerId, model.id)}
                iconUrl={model.iconUrl}
              />
              <span className="min-w-0 flex-1 truncate">{model.name}</span>
              <LockIcon />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuRadioItem
              key={model.id}
              value={model.id}
              closeOnClick
              disabled={disabled || model.disabled}
              title={model.tooltip ?? model.name}
            >
              <ProviderIcon
                providerId={model.iconId ?? getModelIconId(providerId, model.id)}
                iconUrl={model.iconUrl}
              />
              <span className="min-w-0 flex-1 truncate">{model.name}</span>
            </DropdownMenuRadioItem>
          ),
        )}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

function toBlimyOption(
  model: {
    id: string;
    name: string;
    contextWindow?: number;
    input?: number;
    output?: number;
    tier?: string;
  },
  plan: ReturnType<typeof planTierOf>,
): ModelOption {
  const locked = isModelLocked(model.tier, plan);
  if (model.id === "auto")
    return {
      id: model.id,
      name: model.name,
      locked,
      tooltip: joinTooltip([model.name, "blimy picks the model for each request"]),
    };
  const vendor = getModelVendorName(model.id);
  const price = getHostedModelPriceHint(model);
  return {
    id: model.id,
    name: model.name,
    keywords: vendor ? [vendor] : undefined,
    locked,
    tooltip: joinTooltip([
      model.name,
      vendor,
      price ? `${price} per million tokens, billed at list price +10%` : undefined,
      model.contextWindow ? `${formatTokenCount(model.contextWindow)} context` : undefined,
    ]),
  };
}

/**
 * The blimy catalog as two sections: a short "Recommended" pick (hidden while searching, since
 * every pick also sits in the full list) and "Blimy models" with every hosted model. Recommended
 * only shows while the catalog is reachable, which is what having blimy access looks like here.
 * Rows above the account's plan stay fully visible and carry a lock; nothing is hidden or
 * dimmed, and a locked model is still offered in Recommended with its lock so every model is
 * reachable in one glance.
 */
export function BlimyModelSections({
  selected,
  search,
  onSelect,
}: {
  selected: string;
  search: MenuSearch;
  onSelect: (model: string) => void;
}) {
  const { availableModels, isLoadingModels, modelFetchError, retry } = useAIModelOptions(
    "blimy",
    selected || "auto",
  );
  const plan = planTierOf(useProFeature().subscriptionStatus);
  const catalog = useAIChatStore((state) => state.dynamicModels.blimy);
  const models = (catalog ?? availableModels).map((model) => toBlimyOption(model, plan));
  const recommended = modelFetchError ? [] : pickRecommendedModels(models);
  const showsPlansUpgrade = models.some((model) => model.locked) && !search.isSearching;

  return (
    <>
      {recommended.length > 0 && !search.isSearching ? (
        <ModelSection
          id="recommended"
          label="Recommended"
          models={recommended}
          selected={selected}
          onSelect={onSelect}
          providerId="blimy"
          search={search}
        />
      ) : null}
      <ModelSection
        id="blimy"
        label="Blimy models"
        models={models}
        selected={selected}
        onSelect={onSelect}
        providerId="blimy"
        search={search}
        loading={isLoadingModels}
        error={modelFetchError}
        retry={retry}
      />
      {showsPlansUpgrade ? (
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => void openUrl(getServiceUrls().pricingUrl)}
        >
          <SparkleIcon />
          <span className="min-w-0 flex-1 truncate">Upgrade plan</span>
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

export function ProviderModels({
  providerId,
  providerName,
  selected,
  search,
  onSelect,
}: {
  providerId: string;
  providerName: string;
  selected: string;
  search: MenuSearch;
  onSelect: (model: string) => void;
}) {
  const { availableModels, isLoadingModels, modelFetchError, retry } = useAIModelOptions(
    providerId,
    selected,
  );
  return (
    <ModelSection
      id={providerId}
      label={providerName}
      models={availableModels.map((model) => ({
        id: model.id,
        name: model.name,
        tooltip: joinTooltip([
          model.name,
          model.contextWindow ? `${formatTokenCount(model.contextWindow)} context` : undefined,
        ]),
      }))}
      selected={selected}
      onSelect={onSelect}
      providerId={providerId}
      search={search}
      loading={isLoadingModels}
      error={modelFetchError}
      retry={retry}
    />
  );
}
