import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";

import type {
  Capsule,
  CapsuleContextItem,
  CapsuleEvidence,
  CapsuleRun,
  CapsuleWithChildren,
} from "@/features/capsules/types/capsule.types";

let initialized: Promise<void> | null = null;

/** Creates the capsule database on first use; repeat calls share the same promise. */
export function ensureCapsuleDatabase(): Promise<void> {
  if (initialized) return initialized;
  const pending = invoke<void>("init_capsule_database").then(() => undefined);
  const tracked = pending.catch((error) => {
    initialized = null;
    throw error;
  });
  initialized = tracked;
  return tracked;
}

export interface CreateCapsuleInput {
  projectId: string;
  title: string;
  risk?: Capsule["risk"];
  branch?: string | null;
  baseSha?: string | null;
  policy?: string | null;
}

export async function createCapsule(input: CreateCapsuleInput): Promise<Capsule> {
  await ensureCapsuleDatabase();
  const now = Date.now();
  const capsule: Capsule = {
    id: nanoid(),
    project_id: input.projectId,
    title: input.title.trim(),
    status: "open",
    risk: input.risk ?? "medium",
    intent: null,
    policy: input.policy ?? null,
    base_sha: input.baseSha ?? null,
    branch: input.branch ?? null,
    worktree_path: null,
    diagnosis: null,
    revision: 0,
    created_at: now,
    updated_at: now,
  };
  const revision = await invoke<number>("save_capsule", { capsule });
  return { ...capsule, revision };
}

/** Saves the mutable fields of a capsule and returns the revision the row holds afterwards. */
export function saveCapsule(capsule: Capsule): Promise<number> {
  return invoke<number>("save_capsule", { capsule });
}

export function loadCapsule(capsuleId: string): Promise<CapsuleWithChildren> {
  return invoke<CapsuleWithChildren>("load_capsule", { capsuleId });
}

export function listCapsules(projectId: string): Promise<Capsule[]> {
  return invoke<Capsule[]>("list_capsules", { projectId });
}

export function deleteCapsule(capsuleId: string): Promise<void> {
  return invoke("delete_capsule", { capsuleId });
}

export interface AddContextInput {
  capsuleId: string;
  kind: CapsuleContextItem["kind"];
  source: CapsuleContextItem["source"];
  title: string;
  body?: string | null;
  url?: string | null;
  redaction?: string | null;
}

export function addCapsuleContext(input: AddContextInput): Promise<void> {
  const item: CapsuleContextItem = {
    id: nanoid(),
    capsule_id: input.capsuleId,
    kind: input.kind,
    source: input.source,
    title: input.title,
    body: input.body ?? null,
    url: input.url ?? null,
    captured_at: Date.now(),
    redaction: input.redaction ?? null,
  };
  return invoke("add_capsule_context", { item });
}

export interface AddRunInput {
  capsuleId: string;
  kind: CapsuleRun["kind"];
  command: string;
  cwd?: string | null;
  exitCode: number | null;
  durationMs: number;
  log?: string | null;
  filesChanged?: string | null;
}

/** Stores a run. The result says whether its log was trimmed to fit the row. */
export function addCapsuleRun(input: AddRunInput): Promise<boolean> {
  const run: CapsuleRun = {
    id: nanoid(),
    capsule_id: input.capsuleId,
    kind: input.kind,
    command: input.command,
    cwd: input.cwd ?? null,
    exit_code: input.exitCode,
    duration_ms: input.durationMs,
    log: input.log ?? null,
    log_truncated: false,
    files_changed: input.filesChanged ?? null,
    started_at: Date.now(),
  };
  return invoke<boolean>("add_capsule_run", { run });
}

export interface AddEvidenceInput {
  capsuleId: string;
  runId?: string | null;
  kind: string;
  status: CapsuleEvidence["status"];
  title: string;
  summary?: string | null;
  artifactPath?: string | null;
}

export function addCapsuleEvidence(input: AddEvidenceInput): Promise<void> {
  const evidence: CapsuleEvidence = {
    id: nanoid(),
    capsule_id: input.capsuleId,
    run_id: input.runId ?? null,
    kind: input.kind,
    status: input.status,
    title: input.title,
    summary: input.summary ?? null,
    artifact_path: input.artifactPath ?? null,
  };
  return invoke("add_capsule_evidence", { evidence });
}
