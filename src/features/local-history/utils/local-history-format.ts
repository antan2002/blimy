import { formatShortDateTime } from "@/utils/date";
import type { LocalHistoryEntry } from "../api/local-history-api";

export function formatSnapshotSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSnapshotDate(timestamp: number): string {
  return formatShortDateTime(timestamp);
}

/** A named entry shows its label; an unnamed one falls back to its timestamp. */
export function getEntryTitle(entry: LocalHistoryEntry): string {
  return entry.label?.trim() || formatSnapshotDate(entry.created_at);
}
