import { useEffect, useRef, useState } from "react";
import { useToast } from "@/features/layout/contexts/toast-context";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getServiceUrls } from "@/config/services";
import { Alert, AlertDescription } from "@/ui/alert";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty";
import Switch from "@/ui/switch";
import Section, { SettingsView, SettingRow } from "@/features/settings/components/settings-section";
import { writeClipboardText } from "@/utils/clipboard";
import { useAIChatStore } from "@/features/ai/stores/ai-chat.store";
import { useAuthStore } from "@/features/window/stores/auth.store";
import { restoreCloudSessionsIntoDb } from "../services/cloud-session-restore";
import { fetchShareOptions, revokeShare, setSessionSync, updateShare } from "../services/share-api";
import { ShareAccessDialog } from "./share-access-dialog";
import type { SharedItem, ShareOptions } from "../types/share.types";

function sharingErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function SharingSettings() {
  const { showToast } = useToast();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const actionPending = useRef(false);
  const [editing, setEditing] = useState<SharedItem | null>(null);
  const [options, setOptions] = useState<ShareOptions | null>(null);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => setOptions(await fetchShareOptions());
  const run = async (action?: () => Promise<unknown>) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    try {
      await action?.();
    } catch (reason) {
      setError(sharingErrorMessage(reason, "Could not update sharing"));
    } finally {
      await refresh().catch((reason) => {
        setError(
          (current) => current || sharingErrorMessage(reason, "Could not load sharing settings"),
        );
      });
      actionPending.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    setError("");
    void fetchShareOptions().then(
      (next) => {
        if (!cancelled) setOptions(next);
      },
      (reason) => {
        if (!cancelled) setError(sharingErrorMessage(reason, "Could not load sharing settings"));
      },
    );
    const status = (event: Event) => setSyncError((event as CustomEvent).detail.error || "");
    window.addEventListener("blimy:sharing-status", status);
    return () => {
      cancelled = true;
      window.removeEventListener("blimy:sharing-status", status);
    };
  }, [loadAttempt]);
  const copyLink = async (id: string) => {
    try {
      await writeClipboardText(`${base}/s/${id}`);
      showToast({ message: "Link copied", type: "success" });
    } catch (reason) {
      showToast({
        message: sharingErrorMessage(reason, "Could not copy link"),
        type: "error",
      });
    }
  };
  const restore = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw new Error("Sign in to restore sessions from the cloud.");
    }
    const result = await restoreCloudSessionsIntoDb();
    await useAIChatStore.getState().actions.loadChatsFromDatabase();
    showToast({
      message:
        result.restored > 0
          ? `Restored ${result.restored} session${result.restored === 1 ? "" : "s"} from the cloud`
          : "Nothing new to restore",
      type: result.restored > 0 ? "success" : "info",
    });
  };
  const base = getServiceUrls().websiteBaseUrl;
  return (
    <SettingsView>
      <Section title="Cloud Sessions">
        <EmptyState variant="section" message="Cloud sync is not available yet." />
      </Section>
    </SettingsView>
  );
}
