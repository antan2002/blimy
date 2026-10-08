import { useIntelligenceSettingsStore } from "@/features/ai/intelligence/stores/intelligence-settings.store";
import { useAuthStore } from "@/features/window/stores/auth.store";
import { getIntelligenceApiBase } from "@/utils/api-base";
import { getAccessToken } from "@/utils/supabase-access-token";
import { tauriFetch } from "@/utils/tauri-fetch";
import {
  AIProvider,
  type StreamRequest,
  type ProviderHeaders,
  type ProviderModel,
} from "./ai-provider-interface";
import { toOpenAIMessage } from "@/features/ai/lib/image-attachments";

/**
 * The server offers hosted models only to accounts with Blimy Pro or a pay-as-you-go balance.
 * Carries a 402 so chat recovery offers billing instead of provider settings.
 */
export class HostedEntitlementError extends Error {
  readonly status = 402;
  readonly code = "entitlement_required";

  constructor() {
    super(
      "Blimy models need Pro or pay-as-you-go credit. Upgrade or add credit in billing to use them.",
    );
    this.name = "HostedEntitlementError";
  }
}

export class BlimyProvider extends AIProvider {
  async buildHeaders(): Promise<ProviderHeaders> {
    const userId = useAuthStore.getState().user?.id;
    const scope = useIntelligenceSettingsStore.getState().scope;
    const token = await getAccessToken();
    if (
      useAuthStore.getState().user?.id !== userId ||
      useIntelligenceSettingsStore.getState().scope !== scope
    )
      throw new Error("The active account or team changed. Try again.");
    if (!token) throw new Error("Sign in to Blimy to use hosted models.");
    return {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
      Authorization: `Bearer ${token}`,
      "X-Blimy-Intelligence-Scope": scope,
    };
  }

  buildPayload(request: StreamRequest) {
    // The server lowers a larger value to the model's own output limit, and without one it
    // uses that limit, so the model's catalog value is sent as is.
    const maxTokens =
      Number.isFinite(request.maxTokens) && request.maxTokens > 0
        ? Math.floor(request.maxTokens)
        : undefined;
    return {
      model: request.modelId,
      messages: request.messages.map(toOpenAIMessage),
      ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
      temperature: request.temperature,
      stream: true,
    };
  }

  buildUrl(): string {
    // The edge function routes on its own path, and the catalogue lives at /models on the same
    // base, so one base URL serves both requests.
    return `${getIntelligenceApiBase()}/models`;
  }

  override async getModels(): Promise<ProviderModel[]> {
    let response: Response;
    try {
      response = await tauriFetch(this.buildUrl(), {
        headers: await this.buildHeaders(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      throw new Error("Blimy models are not available yet.");
    }
    if (response.status === 401)
      throw new Error("Sign in to use Blimy models.");
    if (response.status === 402) throw new HostedEntitlementError();
    if (!response.ok) throw new Error("Blimy models are not available yet.");
    const result = (await response.json()) as { enabled: boolean; data: ProviderModel[] };
    if (!result.enabled) {
      // Every signed-in tier reaches hosted models, so reaching this branch means the server
      // itself has them switched off rather than the account lacking entitlement.
      throw new Error("Hosted models are not available on this server right now.");
    }
    return result.data;
  }

  async validateApiKey(): Promise<boolean> {
    return Boolean(await getAccessToken());
  }
}
