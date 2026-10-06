import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/features/auth/lib/supabase";
import { useAuthStore } from "@/features/window/stores/auth.store";
import Section, { SettingRow } from "../settings-section";

/**
 * Per-model request counts for hosted models, as recorded by the edge function.
 *
 * Counting is display only. Nothing here blocks a request, so the numbers report how much the
 * shared upstream key has been used rather than enforcing a ceiling, and a limit of 0 means
 * unlimited.
 */
export interface ModelUsageRow {
  scope: "day" | "month";
  model: string;
  requests: number;
  resets_at: string;
  daily_limit: number | null;
  monthly_limit: number | null;
}

const UNLIMITED_LABEL = "Unlimited";

/** Resets are stored as UTC dates; rendering them in UTC is what makes them unreadable. */
export function formatReset(resetsAt: string | null | undefined): string {
  if (!resetsAt) return "";
  const date = new Date(`${resetsAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A label for one model in one period, such as `142 of 200 · resets Nov 1, 3:14 AM`. */
export function describeModelUsage(row: ModelUsageRow): string {
  const limit = row.scope === "day" ? row.daily_limit : row.monthly_limit;
  const used = `${row.requests} ${row.requests === 1 ? "request" : "requests"}`;
  if (!limit || limit <= 0) return `${used} · ${UNLIMITED_LABEL}`;
  const reset = formatReset(row.resets_at);
  return reset ? `${used} of ${limit} · resets ${reset}` : `${used} of ${limit}`;
}

/** Models with usage in this period, most used first. */
function rankRows(rows: ModelUsageRow[], scope: ModelUsageRow["scope"]): ModelUsageRow[] {
  return rows
    .filter((row) => row.scope === scope)
    .sort((a, b) => b.requests - a.requests || a.model.localeCompare(b.model));
}

export function HostedModelUsageSection() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [rows, setRows] = useState<ModelUsageRow[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_model_usage");
    if (error) {
      // Absent until the migration is applied. Nothing is shown rather than an error, since a
      // missing counter is not something the user can act on.
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows((data ?? []) as ModelUsageRow[]);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
  }, [isAuthenticated, load]);

  if (!isAuthenticated || failed) return null;

  const daily = rankRows(rows, "day");
  const monthly = rankRows(rows, "month");

  // Shown even before anything is counted, so the page says where the numbers will appear
  // rather than leaving the user to wonder whether the section exists.
  if (daily.length === 0 && monthly.length === 0) {
    return (
      <Section title="Model usage">
        <SettingRow
          label="Hosted models"
          description="No requests yet. Usage appears here after you send one."
          activateOnClick={false}
        >
          <span className="ui-text-sm text-foreground/60">0 requests</span>
        </SettingRow>
      </Section>
    );
  }

  return (
    <Section title="Model usage">
      {daily.map((row) => (
        <SettingRow
          key={`day-${row.model}`}
          label={row.model}
          description={describeModelUsage(row)}
          activateOnClick={false}
        >
          <span className="ui-text-sm text-foreground/60">today</span>
        </SettingRow>
      ))}
      {monthly.map((row) => (
        <SettingRow
          key={`month-${row.model}`}
          label={`${row.model} · this month`}
          description={describeModelUsage(row)}
          activateOnClick={false}
        >
          <span className="ui-text-sm text-foreground/60">month</span>
        </SettingRow>
      ))}
    </Section>
  );
}