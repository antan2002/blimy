import { supabase } from "@/features/auth/lib/supabase";
import { loadAllChatsFromDb, saveChatToDb } from "@/features/ai/services/ai-chat-history-service";
import { useAuthStore } from "@/features/window/stores/auth.store";
import type { Chat, Message } from "@/features/ai/types/ai-chat.types";

/** One `cloud_sessions` row as the restore path reads it. */
export interface CloudSessionRecord {
  id: string;
  source_id: string | null;
  device_id: string | null;
  title: string;
  kind: string;
  visibility: string;
  content: string;
  language: string;
  messages: unknown;
  source_updated_at: number | null;
}

export interface RestoreResult {
  restored: number;
  existing: number;
}

export interface CloudSessionRestoreDeps {
  list: () => Promise<CloudSessionRecord[]>;
  listLocalChatIds: () => Promise<string[]>;
  save: (chat: Chat) => Promise<void>;
}

/** Cloud messages lose per-message timestamps, so earlier turns are spread before the anchor. */
const RESTORE_STEP_MS = 1000;

function toMessage(entry: { role?: unknown; content?: unknown }, timestamp: Date): Message | null {
  const role = entry?.role === "user" || entry?.role === "assistant" ? entry.role : null;
  const content = typeof entry?.content === "string" ? entry.content : "";
  if (!role || !content.trim()) return null;
  return { id: crypto.randomUUID(), role, content, timestamp, isStreaming: false };
}

/** Builds a chat the local store can hold from one cloud row. */
export function cloudSessionToChat(record: CloudSessionRecord): Chat | null {
  const sourceId = record.source_id;
  if (!sourceId) return null;
  const entries = Array.isArray(record.messages) ? record.messages : [];
  const anchor =
    record.source_updated_at && record.source_updated_at > 0
      ? new Date(record.source_updated_at)
      : new Date();
  const messages: Message[] = entries
    .map((entry, index) => ({
      timestamp: new Date(anchor.getTime() - (entries.length - 1 - index) * RESTORE_STEP_MS),
      entry,
    }))
    .map(({ entry, timestamp }) =>
      toMessage(entry as { role?: unknown; content?: unknown }, timestamp),
    )
    .filter((message): message is Message => message !== null);
  if (messages.length === 0 && record.content.trim()) {
    messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: record.content,
      timestamp: anchor,
      isStreaming: false,
    });
  }
  if (messages.length === 0) return null;
  return {
    id: sourceId,
    title: record.title.trim() || "Untitled session",
    messages,
    createdAt: messages[0].timestamp,
    lastMessageAt: messages[messages.length - 1].timestamp,
    agentId: "custom",
    isPinned: false,
    archivedAt: null,
  };
}

/**
 * Restores cloud sessions that are missing on this device. Local sessions keep their working
 * copy; only agent chats with a cloud row and no local chat of the same id are recreated, so
 * running the same restore twice is a no-op.
 */
export function createCloudSessionRestore(deps: CloudSessionRestoreDeps) {
  return async (): Promise<RestoreResult> => {
    const records = await deps.list();
    const localIds = new Set(await deps.listLocalChatIds());
    let restored = 0;
    let existing = 0;
    for (const record of records) {
      if (record.kind !== "agent" || record.visibility !== "private") continue;
      const chat = cloudSessionToChat(record);
      if (!chat) continue;
      if (localIds.has(chat.id)) {
        existing += 1;
        continue;
      }
      await deps.save(chat);
      localIds.add(chat.id);
      restored += 1;
    }
    return { restored, existing };
  };
}

export const restoreCloudSessionsIntoDb = createCloudSessionRestore({
  list: async () => {
    if (!useAuthStore.getState().isAuthenticated) return [];
    const { data } = await supabase
      .from("cloud_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    return (data ?? []) as CloudSessionRecord[];
  },
  listLocalChatIds: async () => (await loadAllChatsFromDb()).map((chat) => chat.id),
  save: saveChatToDb,
});
