import { getEdgeFunctionsBase } from "@/utils/api-base";
import { getSupabaseAccessToken } from "@/utils/supabase-access-token";
import { tauriFetch } from "@/utils/tauri-fetch";

export interface CloudSettingsSyncSnapshot {
  schemaVersion: number;
  updatedAt: string;
  settings: Record<string, unknown>;
}

export class SettingsSyncApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SettingsSyncApiError";
  }
}

/** Whether the failure means the session is gone; a plain 401 is a rejected token. */
export function isAuthInvalidError(error: unknown): boolean {
  return error instanceof SettingsSyncApiError && error.status === 401;
}

const SETTINGS_SYNC_FUNCTION = "settings-sync";

async function request<T>(init?: RequestInit): Promise<T> {
  const token = await getSupabaseAccessToken();
  if (!token) throw new SettingsSyncApiError("Not signed in.", 401);
  const response = await tauriFetch(`${getEdgeFunctionsBase()}/${SETTINGS_SYNC_FUNCTION}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  const body = (await response.json().catch(() => null)) as
    | { snapshot?: CloudSettingsSyncSnapshot | null; error?: string }
    | null;
  if (!response.ok)
    throw new SettingsSyncApiError(
      body?.error || `Settings sync failed (${response.status}).`,
      response.status,
    );
  return body as T;
}

export async function fetchSettingsSyncSnapshot(): Promise<CloudSettingsSyncSnapshot | null> {
  const { snapshot } = await request<{ snapshot?: CloudSettingsSyncSnapshot | null }>();
  return snapshot ?? null;
}

export async function pushSettingsSyncSnapshot(input: {
  schemaVersion: number;
  settings: Record<string, unknown>;
}): Promise<CloudSettingsSyncSnapshot> {
  const { snapshot } = await request<{ snapshot?: CloudSettingsSyncSnapshot }>({
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!snapshot) {
    throw new SettingsSyncApiError("The server did not return a settings snapshot.", 502);
  }
  return snapshot;
}