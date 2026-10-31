import { create } from "zustand";

import {
  addCapsuleEvidence,
  addCapsuleRun,
  createCapsule,
  loadCapsule,
  type AddEvidenceInput,
  type AddRunInput,
  type CreateCapsuleInput,
} from "@/features/capsules/services/capsule-service";
import type { Capsule, CapsuleWithChildren } from "@/features/capsules/types/capsule.types";
import { createSelectors } from "@/utils/zustand-selectors";

interface CapsuleState {
  /** The capsule in view, with its context, runs, and evidence. */
  active: CapsuleWithChildren | null;
  loading: boolean;
  error: string | null;
  actions: {
    create: (input: CreateCapsuleInput) => Promise<Capsule>;
    open: (capsuleId: string) => Promise<void>;
    addRun: (input: AddRunInput) => Promise<boolean>;
    addEvidence: (input: AddEvidenceInput) => Promise<void>;
    refresh: () => Promise<void>;
    close: () => void;
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The capsule could not be loaded.";
}

const useCapsuleStoreBase = create<CapsuleState>()((set, get) => ({
  active: null,
  loading: false,
  error: null,
  actions: {
    create: async (input) => {
      const capsule = await createCapsule(input);
      set({ active: { capsule, context: [], runs: [], evidence: [] }, error: null });
      return capsule;
    },
    open: async (capsuleId) => {
      set({ loading: true, error: null });
      try {
        set({ active: await loadCapsule(capsuleId), loading: false });
      } catch (error) {
        set({ loading: false, error: message(error) });
      }
    },
    addRun: async (input) => {
      const truncated = await addCapsuleRun(input);
      await get().actions.refresh();
      return truncated;
    },
    addEvidence: async (input) => {
      await addCapsuleEvidence(input);
      await get().actions.refresh();
    },
    refresh: async () => {
      const current = get().active;
      if (!current) return;
      try {
        set({ active: await loadCapsule(current.capsule.id), error: null });
      } catch (error) {
        set({ error: message(error) });
      }
    },
    close: () => set({ active: null, loading: false, error: null }),
  },
}));

export const useCapsuleStore = createSelectors(useCapsuleStoreBase);
