import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Capsule, CapsuleWithChildren } from "@/features/capsules/types/capsule.types";

const service = vi.hoisted(() => ({
  createCapsule: vi.fn(),
  loadCapsule: vi.fn(),
  addCapsuleRun: vi.fn(),
  addCapsuleEvidence: vi.fn(),
}));

vi.mock("@/features/capsules/services/capsule-service", () => service);

import { useCapsuleStore } from "@/features/capsules/stores/capsule.store";

function capsule(id: string): Capsule {
  return {
    id,
    project_id: "blimydev/blimy",
    title: "Export returns 500",
    status: "open",
    risk: "medium",
    intent: null,
    policy: null,
    base_sha: null,
    branch: null,
    worktree_path: null,
    diagnosis: null,
    revision: 0,
    created_at: 1,
    updated_at: 1,
  };
}

function withChildren(value: Capsule): CapsuleWithChildren {
  return { capsule: value, context: [], runs: [], evidence: [] };
}

describe("capsule store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCapsuleStore.getState().actions.close();
  });

  it("shows a new capsule as soon as it is created", async () => {
    const created = capsule("capsule-1");
    service.createCapsule.mockResolvedValue(created);

    const result = await useCapsuleStore
      .getState()
      .actions.create({ projectId: "blimydev/blimy", title: "Export returns 500" });

    expect(result).toBe(created);
    expect(useCapsuleStore.getState().active?.capsule.id).toBe("capsule-1");
  });

  it("reports a load failure instead of leaving a stale capsule", async () => {
    service.loadCapsule.mockRejectedValue(new Error("Failed to load capsule"));

    await useCapsuleStore.getState().actions.open("capsule-1");

    expect(useCapsuleStore.getState().active).toBeNull();
    expect(useCapsuleStore.getState().error).toBe("Failed to load capsule");
    expect(useCapsuleStore.getState().loading).toBe(false);
  });

  it("reloads after a run so the view shows what was stored", async () => {
    service.loadCapsule.mockResolvedValue(withChildren(capsule("capsule-1")));
    service.addCapsuleRun.mockResolvedValue(false);

    await useCapsuleStore.getState().actions.open("capsule-1");
    const truncated = await useCapsuleStore.getState().actions.addRun({
      capsuleId: "capsule-1",
      kind: "unit",
      command: "bun test",
      exitCode: 0,
      durationMs: 12,
    });

    expect(truncated).toBe(false);
    expect(service.addCapsuleRun).toHaveBeenCalledTimes(1);
    expect(service.loadCapsule).toHaveBeenCalledTimes(2);
  });
});
