import type { PastedImage } from "@/features/ai/types/chat-composer.types";
import type { EditorSelectionContext } from "@/features/ai/types/ai-context.types";

export interface AgentWindowDraft {
  text: string;
  images: PastedImage[];
  bufferIds: string[];
  filePaths: string[];
  editorContexts: EditorSelectionContext[];
}

type DraftReader = () => AgentWindowDraft;
const readers = new Map<string, DraftReader>();
let drafts: Record<string, AgentWindowDraft> = {};

export function peekAgentDraft(id: string) {
  return drafts[id];
}

export function registerAgentDraft(id: string, reader: DraftReader) {
  readers.set(id, reader);
  return () => {
    if (readers.get(id) !== reader) return;
    drafts[id] = reader();
    readers.delete(id);
  };
}

export function takeAgentDraft(id: string) {
  const draft = drafts[id];
  delete drafts[id];
  return draft;
}

export function captureAgentDrafts() {
  for (const [id, reader] of readers) drafts[id] = reader();
  return structuredClone(drafts);
}

export function restoreAgentDrafts(next: Record<string, AgentWindowDraft>, merge = false) {
  drafts = merge ? { ...drafts, ...structuredClone(next) } : structuredClone(next);
}

export function hasAnyAgentDraftReader(): boolean {
  return readers.size > 0;
}

export function appendAgentDraftText(id: string, text: string) {
  const existing = peekAgentDraft(id);
  const currentText = existing?.text ?? "";
  const prefix = currentText.trim().length > 0 && !/\s$/.test(currentText) ? "\n\n" : "";
  const newText = `${currentText}${prefix}${text} `;

  drafts[id] = {
    text: newText,
    images: existing?.images ?? [],
    bufferIds: existing?.bufferIds ?? [],
    filePaths: existing?.filePaths ?? [],
    editorContexts: existing?.editorContexts ?? [],
  };
}
