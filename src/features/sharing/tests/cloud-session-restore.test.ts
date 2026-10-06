import { describe, expect, it, vi } from "vite-plus/test";
import type { Chat } from "@/features/ai/types/ai-chat.types";
import {
  cloudSessionToChat,
  createCloudSessionRestore,
  type CloudSessionRecord,
  type CloudSessionRestoreDeps,
} from "../services/cloud-session-restore";

const record = (over: Partial<CloudSessionRecord> = {}): CloudSessionRecord => ({
  id: "row-1",
  source_id: "chat-1",
  device_id: "dev",
  title: "A session",
  kind: "agent",
  visibility: "private",
  content: "",
  language: "markdown",
  messages: [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ],
  source_updated_at: 1000,
  ...over,
});

function setup(records: CloudSessionRecord[], localIds: string[] = []) {
  const saved: Chat[] = [];
  const deps: CloudSessionRestoreDeps = {
    list: vi.fn(async () => records),
    listLocalChatIds: vi.fn(async () => localIds),
    save: vi.fn(async (chat: Chat) => {
      saved.push(chat);
    }),
  };
  return { deps, saved, restore: createCloudSessionRestore(deps) };
}

describe("cloud session restore", () => {
  it("recreates missing private agent sessions on this device", async () => {
    const { restore, saved } = setup([record()]);
    const result = await restore();
    expect(result).toEqual({ restored: 1, existing: 0 });
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("chat-1");
    expect(saved[0].messages.map((message) => message.content)).toEqual(["hi", "hello"]);
  });

  it("keeps the local working copy and counts sessions already present", async () => {
    const { restore, saved } = setup([record()], ["chat-1"]);
    const result = await restore();
    expect(result).toEqual({ restored: 0, existing: 1 });
    expect(saved).toHaveLength(0);
  });

  it("ignores public shares and non-agent rows", async () => {
    const { restore, saved } = setup([
      record({ id: "p", source_id: "pub", kind: "snippet", visibility: "public" }),
      record({ id: "d", source_id: "dev", kind: "agent", visibility: "public" }),
    ]);
    const result = await restore();
    expect(result).toEqual({ restored: 0, existing: 0 });
    expect(saved).toHaveLength(0);
  });

  it("restores every missing session once and refuses duplicates within a run", async () => {
    const { restore, saved } = setup([record(), record()]);
    const result = await restore();
    expect(result).toEqual({ restored: 1, existing: 1 });
    expect(saved).toHaveLength(1);
  });

  it("falls back to the stored content when the session has no message list", async () => {
    const chat = cloudSessionToChat(
      record({ messages: [], content: "## Agent\n\nfallback", source_updated_at: 5000 }),
    );
    expect(chat).not.toBeNull();
    expect(chat!.title).toBe("A session");
    expect(chat!.messages).toHaveLength(1);
    expect(chat!.messages[0].role).toBe("assistant");
    expect(chat!.messages[0].content).toBe("## Agent\n\nfallback");
  });

  it("defaults a blank title to Untitled session", () => {
    const chat = cloudSessionToChat(record({ title: "   " }));
    expect(chat!.title).toBe("Untitled session");
  });

  it("orders synthesized messages so the last turn carries the source timestamp", () => {
    const chat = cloudSessionToChat(
      record({
        source_updated_at: 10_000,
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "second" },
        ],
      }),
    );
    expect(chat).not.toBeNull();
    expect(chat!.messages[0].timestamp.getTime()).toBe(9_000);
    expect(chat!.messages[1].timestamp.getTime()).toBe(10_000);
    expect(chat!.lastMessageAt.getTime()).toBe(10_000);
  });

  it("drops messages without a usable role or content", () => {
    const chat = cloudSessionToChat(
      record({
        messages: [
          { role: "system", content: "ignored" },
          { role: "user", content: "  " },
          { role: "user", content: "kept" },
        ],
      }),
    );
    expect(chat!.messages.map((message) => message.content)).toEqual(["kept"]);
  });
});