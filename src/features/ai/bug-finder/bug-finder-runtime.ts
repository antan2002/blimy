import { useDiagnosticsStore } from "@/features/diagnostics/stores/diagnostics.store";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { getFileDiff } from "@/features/git/api/git-diff-api";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { logger } from "@/features/editor/utils/logger";

import { loadAiIgnore } from "../lib/ai-ignore";
import type { AiIgnoreMatcher } from "../types/ai-ignore.types";
import { callBugFinderModel } from "./bug-finder-model";
import { BUG_FINDER_OWNER, type BugFinding } from "./bug-finder-review";
import { createBugFinderService, type BugFinderService } from "./bug-finder-service";

let service: BugFinderService | null = null;

const ignoreMatchers = new Map<string, AiIgnoreMatcher>();
const ignoreLoads = new Map<string, Promise<AiIgnoreMatcher>>();

async function getIgnoreMatcher(projectRoot: string): Promise<AiIgnoreMatcher> {
  const cached = ignoreMatchers.get(projectRoot);

  if (cached) {
    return cached;
  }

  const pending = ignoreLoads.get(projectRoot);

  if (pending) {
    return pending;
  }

  const load = loadAiIgnore(projectRoot)
    .then((loaded) => {
      ignoreMatchers.set(projectRoot, loaded.matcher);
      return loaded.matcher;
    })
    .catch(() => {
      const matcher: AiIgnoreMatcher = () => false;
      ignoreMatchers.set(projectRoot, matcher);
      return matcher;
    })
    .finally(() => {
      ignoreLoads.delete(projectRoot);
    });

  ignoreLoads.set(projectRoot, load);

  return load;
}

function relativeToRoot(projectRoot: string, filePath: string): string {
  const normalizedRoot = projectRoot.replace(/[\\/]+$/, "");

  if (!filePath.startsWith(normalizedRoot)) {
    return filePath.replace(/\\/g, "/");
  }

  return filePath
    .slice(normalizedRoot.length)
    .replace(/^[\\/]+/, "")
    .replace(/\\/g, "/");
}

export function getBugFinderService(): BugFinderService {
  if (service) {
    return service;
  }

  service = createBugFinderService({
    callModel: callBugFinderModel,
    getFileDiff: async (filePath, content) => {
      const projectRoot = useFileSystemStore.getState().rootFolderPath;

      if (!projectRoot) {
        return null;
      }

      return getFileDiff(projectRoot, filePath, false, content);
    },
    setDiagnostics: (filePath, diagnostics, owner) => {
      useDiagnosticsStore.getState().actions.setDiagnostics(filePath, diagnostics, owner);
    },
    isEnabled: () => {
      const settings = useSettingsStore.getState().settings;
      return settings.aiEnabled && settings.aiBugFinder;
    },
    isIgnored: (filePath) => {
      const projectRoot = useFileSystemStore.getState().rootFolderPath;

      if (!projectRoot) {
        return false;
      }

      const matcher = ignoreMatchers.get(projectRoot);

      return matcher ? matcher(relativeToRoot(projectRoot, filePath)) : false;
    },
    onError: (error) => {
      logger.warn("BugFinder", "Background review failed:", error);
    },
  });

  return service;
}

/**
 * Review a saved file in the background. Callers fire and forget; the review
 * owns its own errors and only ever writes diagnostics.
 */
export async function reviewSavedFile(input: {
  filePath: string;
  content: string;
}): Promise<BugFinding[]> {
  const settings = useSettingsStore.getState().settings;
  if (!settings.aiEnabled || !settings.aiBugFinder) {
    return [];
  }

  const projectRoot = useFileSystemStore.getState().rootFolderPath;

  if (projectRoot) {
    await getIgnoreMatcher(projectRoot);
  }

  try {
    return await getBugFinderService().reviewFile(input);
  } catch (error) {
    logger.warn("BugFinder", "Background review failed:", error);
    return [];
  }
}

export function resetBugFinderRuntime(): void {
  service = null;
  ignoreMatchers.clear();
  ignoreLoads.clear();
}

/**
 * Drop every published finding. Called when the feature is switched off so the
 * editor does not keep squiggles the user can no longer refresh.
 */
export function clearBugFinderDiagnostics(): void {
  const { diagnosticsByFile, actions } = useDiagnosticsStore.getState();

  for (const filePath of diagnosticsByFile.keys()) {
    actions.clearDiagnosticsForOwner(filePath, BUG_FINDER_OWNER);
  }
}
