import { generateText } from "ai";

import { getIntelligenceSdkModel } from "@/features/ai/intelligence/services/intelligence-sdk-model";
import { useSettingsStore } from "@/features/settings/stores/settings.store";

import type { BugFinderModelRequest } from "./bug-finder-service";

const MAX_BUG_FINDER_OUTPUT_TOKENS = 2048;

/**
 * One headless model turn for a background review. This deliberately does not
 * touch `ai-chat.store`, so a review never shows up as a chat message and never
 * disturbs the open conversation.
 */
export async function callBugFinderModel(request: BugFinderModelRequest): Promise<string> {
  const settings = useSettingsStore.getState().settings;
  const model = await getIntelligenceSdkModel(
    settings.aiProviderId,
    settings.aiModelId,
    "bug-finder",
  );
  const result = await generateText({
    model,
    system: request.systemPrompt,
    prompt: request.prompt,
    maxOutputTokens: MAX_BUG_FINDER_OUTPUT_TOKENS,
    maxRetries: 0,
  });

  return result.text;
}
