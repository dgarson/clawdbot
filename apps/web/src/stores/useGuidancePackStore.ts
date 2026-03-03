import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uuidv7 } from "@/lib/ids";

export type GuidancePack = {
  id: string;
  name: string;
  summary: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

interface GuidancePackState {
  packs: GuidancePack[];
}

interface GuidancePackActions {
  createPack: (input: Omit<GuidancePack, "id" | "createdAt" | "updatedAt">) => void;
  updatePack: (id: string, patch: Partial<Omit<GuidancePack, "id">>) => void;
  removePack: (id: string) => void;
  duplicatePack: (id: string) => void;
}

type GuidancePackStore = GuidancePackState & GuidancePackActions;

const defaultPacks: GuidancePack[] = [
  {
    id: "pack-weekly-clarity",
    name: "Weekly Report Clarity",
    summary: "Keep weekly summaries crisp, outcome-focused, and skimmable.",
    content:
      "Write in short sections. Lead with outcomes, then blockers, then next steps. Keep bullet points under 10 words when possible.",
    tags: ["reports", "tone", "clarity"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pack-privacy-first",
    name: "Privacy First",
    summary: "Avoid sensitive data and sanitize any identifiers in outputs.",
    content:
      "Never include real phone numbers, emails, or internal hostnames. Replace with placeholders and remove PII from examples.",
    tags: ["privacy", "safety"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useGuidancePackStore = create<GuidancePackStore>()(
  persist(
    (set) => ({
      packs: defaultPacks,
      createPack: (input) => {
        const now = new Date().toISOString();
        set((state) => ({
          packs: [
            {
              ...input,
              id: uuidv7(),
              createdAt: now,
              updatedAt: now,
            },
            ...state.packs,
          ],
        }));
      },
      updatePack: (id, patch) => {
        set((state) => ({
          packs: state.packs.map((pack) =>
            pack.id === id
              ? { ...pack, ...patch, updatedAt: new Date().toISOString() }
              : pack
          ),
        }));
      },
      removePack: (id) => {
        set((state) => ({
          packs: state.packs.filter((pack) => pack.id !== id),
        }));
      },
      duplicatePack: (id) => {
        set((state) => {
          const original = state.packs.find((pack) => pack.id === id);
          if (!original) {return state;}
          const now = new Date().toISOString();
          return {
            packs: [
              {
                ...original,
                id: uuidv7(),
                name: `${original.name} (Copy)`,
                createdAt: now,
                updatedAt: now,
              },
              ...state.packs,
            ],
          };
        });
      },
    }),
    { name: "guidance-packs" }
  )
);
