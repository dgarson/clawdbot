const STORAGE_KEY = "openclaw.control.tool-policy-presets.v2";
const LEGACY_STORAGE_KEY = "openclaw.control.tool-policy-presets.v1";
const VALID_PROFILES = new Set(["minimal", "coding", "messaging", "full"]);

export type ToolPolicyPreset = {
  id: string;
  name: string;
  description: string;
  profile: string;
  alsoAllow: string[];
  deny: string[];
  version: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ToolPolicyPresetInput = {
  name: string;
  description?: string;
  profile: string;
  alsoAllow: string[];
  deny: string[];
};

export type ToolPolicyPresetAssignments = {
  agents: Record<string, string>;
  providers: Record<string, string>;
};

type ToolPolicyPresetStore = {
  version: 2;
  presets: ToolPolicyPreset[];
  assignments: ToolPolicyPresetAssignments;
};

type LegacyPreset = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  profile?: unknown;
  alsoAllow?: unknown;
  deny?: unknown;
  updatedAtMs?: unknown;
};

type LegacyStore = {
  version?: unknown;
  presets?: unknown;
};

export function loadToolPolicyPresets(): ToolPolicyPreset[] {
  return readStore().presets;
}

export function loadToolPolicyPresetAssignments(): ToolPolicyPresetAssignments {
  return readStore().assignments;
}

export function createToolPolicyPreset(input: ToolPolicyPresetInput): ToolPolicyPreset[] {
  const normalizedInput = normalizeInput(input);
  if (!normalizedInput) {
    return readStore().presets;
  }
  const now = Date.now();
  return writeStore((store) => ({
    ...store,
    presets: [
      {
        id: createPresetId(),
        name: normalizedInput.name,
        description: normalizedInput.description,
        profile: normalizedInput.profile,
        alsoAllow: normalizedInput.alsoAllow,
        deny: normalizedInput.deny,
        version: 1,
        createdAtMs: now,
        updatedAtMs: now,
      },
      ...store.presets,
    ],
  })).presets;
}

export function updateToolPolicyPreset(
  id: string,
  input: ToolPolicyPresetInput,
): ToolPolicyPreset[] {
  const normalizedId = id.trim();
  const normalizedInput = normalizeInput(input);
  if (!normalizedId || !normalizedInput) {
    return readStore().presets;
  }
  const now = Date.now();
  return writeStore((store) => ({
    ...store,
    presets: store.presets.map((preset) => {
      if (preset.id !== normalizedId) {
        return preset;
      }
      return {
        ...preset,
        name: normalizedInput.name,
        description: normalizedInput.description,
        profile: normalizedInput.profile,
        alsoAllow: normalizedInput.alsoAllow,
        deny: normalizedInput.deny,
        version: (preset.version || 1) + 1,
        updatedAtMs: now,
      };
    }),
  })).presets;
}

export function duplicateToolPolicyPreset(id: string): ToolPolicyPreset[] {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return readStore().presets;
  }
  const store = readStore();
  const source = store.presets.find((preset) => preset.id === normalizedId);
  if (!source) {
    return store.presets;
  }
  const now = Date.now();
  return writeStore((current) => ({
    ...current,
    presets: [
      {
        ...source,
        id: createPresetId(),
        name: `${source.name} Copy`,
        version: 1,
        createdAtMs: now,
        updatedAtMs: now,
      },
      ...current.presets,
    ],
  })).presets;
}

export function deleteToolPolicyPreset(id: string): ToolPolicyPreset[] {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return readStore().presets;
  }
  return writeStore((store) => ({
    ...store,
    presets: store.presets.filter((entry) => entry.id !== normalizedId),
    assignments: pruneAssignmentsForPreset(store.assignments, normalizedId),
  })).presets;
}

export function assignToolPolicyPresetToAgent(agentId: string, presetId: string | null) {
  const normalizedAgentId = agentId.trim();
  if (!normalizedAgentId) {
    return readStore().assignments;
  }
  return writeStore((store) => ({
    ...store,
    assignments: {
      ...store.assignments,
      agents: assignMapping(store.assignments.agents, normalizedAgentId, presetId),
    },
  })).assignments;
}

export function assignToolPolicyPresetToProvider(providerKey: string, presetId: string | null) {
  const normalizedProviderKey = providerKey.trim();
  if (!normalizedProviderKey) {
    return readStore().assignments;
  }
  return writeStore((store) => ({
    ...store,
    assignments: {
      ...store.assignments,
      providers: assignMapping(store.assignments.providers, normalizedProviderKey, presetId),
    },
  })).assignments;
}

export function bulkAssignToolPolicyPresetToAgents(agentIds: string[], presetId: string | null) {
  return writeStore((store) => {
    const nextAgents = { ...store.assignments.agents };
    for (const rawId of agentIds) {
      const id = rawId.trim();
      if (!id) {
        continue;
      }
      if (presetId) {
        nextAgents[id] = presetId;
      } else {
        delete nextAgents[id];
      }
    }
    return {
      ...store,
      assignments: {
        ...store.assignments,
        agents: nextAgents,
      },
    };
  }).assignments;
}

export function bulkAssignToolPolicyPresetToProviders(
  providerKeys: string[],
  presetId: string | null,
) {
  return writeStore((store) => {
    const nextProviders = { ...store.assignments.providers };
    for (const rawKey of providerKeys) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }
      if (presetId) {
        nextProviders[key] = presetId;
      } else {
        delete nextProviders[key];
      }
    }
    return {
      ...store,
      assignments: {
        ...store.assignments,
        providers: nextProviders,
      },
    };
  }).assignments;
}

function readStore(): ToolPolicyPresetStore {
  const parsed = readV2Store();
  if (parsed) {
    return parsed;
  }
  const migrated = readLegacyStore();
  if (migrated) {
    writeRawStore(migrated);
    return migrated;
  }
  return {
    version: 2,
    presets: [],
    assignments: {
      agents: {},
      providers: {},
    },
  };
}

function readV2Store(): ToolPolicyPresetStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ToolPolicyPresetStore>;
    if (parsed.version !== 2 || !Array.isArray(parsed.presets)) {
      return null;
    }
    const assignments = normalizeAssignments(parsed.assignments);
    return {
      version: 2,
      presets: parsed.presets
        .map((entry) => normalizePreset(entry))
        .filter((entry): entry is ToolPolicyPreset => Boolean(entry))
        .toSorted((a, b) => b.updatedAtMs - a.updatedAtMs),
      assignments,
    };
  } catch {
    return null;
  }
}

function readLegacyStore(): ToolPolicyPresetStore | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LegacyStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) {
      return null;
    }
    const now = Date.now();
    const presets = parsed.presets
      .map((entry) => normalizeLegacyPreset(entry, now))
      .filter((entry): entry is ToolPolicyPreset => Boolean(entry))
      .toSorted((a, b) => b.updatedAtMs - a.updatedAtMs);
    return {
      version: 2,
      presets,
      assignments: {
        agents: {},
        providers: {},
      },
    };
  } catch {
    return null;
  }
}

function normalizeLegacyPreset(raw: unknown, fallbackTime: number): ToolPolicyPreset | null {
  const legacy = raw as LegacyPreset;
  if (!legacy || typeof legacy !== "object") {
    return null;
  }
  const id =
    typeof legacy.id === "string" && legacy.id.trim() ? legacy.id.trim() : createPresetId();
  const name = typeof legacy.name === "string" ? legacy.name.trim() : "";
  if (!name) {
    return null;
  }
  const updatedAtMs = Number.isFinite(legacy.updatedAtMs)
    ? Number(legacy.updatedAtMs)
    : fallbackTime;
  return {
    id,
    name,
    description: typeof legacy.description === "string" ? legacy.description.trim() : "",
    profile: normalizeProfile(legacy.profile),
    alsoAllow: normalizeList(legacy.alsoAllow),
    deny: normalizeList(legacy.deny),
    version: 1,
    createdAtMs: updatedAtMs,
    updatedAtMs,
  };
}

function writeStore(mutator: (store: ToolPolicyPresetStore) => ToolPolicyPresetStore) {
  const current = readStore();
  const next = mutator(current);
  const normalized = {
    version: 2 as const,
    presets: next.presets
      .map((entry) => normalizePreset(entry))
      .filter((entry): entry is ToolPolicyPreset => Boolean(entry))
      .toSorted((a, b) => b.updatedAtMs - a.updatedAtMs),
    assignments: normalizeAssignments(next.assignments),
  };
  writeRawStore(normalized);
  return normalized;
}

function writeRawStore(store: ToolPolicyPresetStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

function normalizeInput(input: ToolPolicyPresetInput): ToolPolicyPresetInput | null {
  const name = input.name.trim();
  if (!name) {
    return null;
  }
  const profile = normalizeProfile(input.profile);
  return {
    name,
    description: (input.description ?? "").trim(),
    profile,
    alsoAllow: normalizeList(input.alsoAllow),
    deny: normalizeList(input.deny),
  };
}

function normalizePreset(raw: unknown): ToolPolicyPreset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<ToolPolicyPreset>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    return null;
  }
  if (typeof record.name !== "string" || !record.name.trim()) {
    return null;
  }
  const updatedAtMs = Number.isFinite(record.updatedAtMs) ? Number(record.updatedAtMs) : 0;
  const createdAtMs = Number.isFinite(record.createdAtMs)
    ? Number(record.createdAtMs)
    : updatedAtMs;
  return {
    id: record.id.trim(),
    name: record.name.trim(),
    description: typeof record.description === "string" ? record.description.trim() : "",
    profile: normalizeProfile(record.profile),
    alsoAllow: normalizeList(record.alsoAllow),
    deny: normalizeList(record.deny),
    version:
      Number.isFinite(record.version) && Number(record.version) > 0
        ? Math.floor(Number(record.version))
        : 1,
    createdAtMs,
    updatedAtMs,
  };
}

function normalizeAssignments(raw: unknown): ToolPolicyPresetAssignments {
  if (!raw || typeof raw !== "object") {
    return { agents: {}, providers: {} };
  }
  const record = raw as Partial<ToolPolicyPresetAssignments>;
  return {
    agents: normalizeAssignmentRecord(record.agents),
    providers: normalizeAssignmentRecord(record.providers),
  };
}

function normalizeAssignmentRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const input = raw as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    next[normalizedKey] = normalizedValue;
  }
  return next;
}

function normalizeProfile(raw: unknown): string {
  if (typeof raw === "string") {
    const normalized = raw.trim();
    if (VALID_PROFILES.has(normalized)) {
      return normalized;
    }
  }
  return "full";
}

function normalizeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of raw) {
    const value = typeof entry === "string" ? entry.trim() : "";
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    list.push(value);
  }
  return list;
}

function assignMapping(source: Record<string, string>, key: string, presetId: string | null) {
  const next = { ...source };
  const normalizedPresetId = presetId?.trim() ?? "";
  if (normalizedPresetId) {
    next[key] = normalizedPresetId;
  } else {
    delete next[key];
  }
  return next;
}

function pruneAssignmentsForPreset(
  assignments: ToolPolicyPresetAssignments,
  presetId: string,
): ToolPolicyPresetAssignments {
  return {
    agents: removePresetFromMapping(assignments.agents, presetId),
    providers: removePresetFromMapping(assignments.providers, presetId),
  };
}

function removePresetFromMapping(mapping: Record<string, string>, presetId: string) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (value === presetId) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function createPresetId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `preset_${Date.now().toString(36)}_${random}`;
}
