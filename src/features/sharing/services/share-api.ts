import { getEdgeFunctionsBase } from "@/utils/api-base";
import { getAccessToken } from "@/utils/supabase-access-token";
import { tauriFetch } from "@/utils/tauri-fetch";
import type { ShareInput, ShareOptions } from "../types/share.types";

const CLOUD_SESSIONS_FUNCTION = "cloud-sessions";

export class ShareRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ShareRequestError";
    this.status = status;
  }
}

/** The server rejected the payload itself; retrying with the same content cannot succeed. */
export function isRejectedShareRequest(error: unknown) {
  return error instanceof ShareRequestError && (error.status === 400 || error.status === 413);
}

/**
 * Calls the `cloud-sessions` edge function. The caller's `path` keeps the old first-party host
 * routes (`/api/shares`, `/api/cloud-sessions`) so every call site reads the same as before;
 * only the base and the bearer token changed, and the token is the live Supabase session.
 */
export async function shareRequest<T>(
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> {
  const bearer = token ?? (await getAccessToken());
  if (!bearer) throw new ShareRequestError("Not signed in.", 401);
  // `/api/cloud-sessions` is the function's own root; `/api/shares...` become subpaths of it.
  const subpath = path.replace(/^\/api/, "");
  const route = subpath === "/cloud-sessions" ? "" : subpath;
  const response = await tauriFetch(
    `${getEdgeFunctionsBase()}/${CLOUD_SESSIONS_FUNCTION}${route}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  const body = (await response.json()) as { error?: string } | null;
  if (!response.ok)
    throw new ShareRequestError(
      body?.error || "Could not reach blimy sharing. Try again.",
      response.status,
    );
  return body as T;
}

export function fetchShareOptions(token?: string) {
  return shareRequest<ShareOptions>("/api/shares", undefined, token);
}

export function createShare(input: ShareInput) {
  return shareRequest<{ id: string; url: string }>("/api/shares", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeShare(id: string) {
  return shareRequest<{ revoked: boolean }>(`/api/shares/${id}`, { method: "DELETE" });
}

export function updateShare(
  id: string,
  revision: number,
  changes: Record<string, unknown>,
  token?: string,
) {
  return shareRequest<{ revision: number }>(
    `/api/shares/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...changes, revision }),
    },
    token,
  );
}

export function setSessionSync(enabled: boolean) {
  return shareRequest<{ sessionsEnabled: boolean }>("/api/cloud-sessions", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}
