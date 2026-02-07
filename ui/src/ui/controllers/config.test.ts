import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  applyConfigSnapshot,
  applyConfigSchema,
  applyConfig,
  runUpdate,
  updateConfigFormValue,
  loadConfigSchema,
  clearSchemaCache,
  type ConfigState,
} from "./config.ts";

function createState(): ConfigState {
  return {
    applySessionKey: "main",
    client: null,
    configActiveSection: null,
    configActiveSubsection: null,
    configApplying: false,
    configForm: null,
    configFormDirty: false,
    configFormMode: "form",
    configFormOriginal: null,
    configIssues: [],
    configLoading: false,
    configRaw: "",
    configRawOriginal: "",
    configSaving: false,
    configSchema: null,
    configSchemaLoading: false,
    configSchemaVersion: null,
    configSearchQuery: "",
    configSnapshot: null,
    configUiHints: {},
    configValid: null,
    connected: false,
    lastError: null,
    updateRunning: false,
  };
}

describe("applyConfigSnapshot", () => {
  it("does not clobber form edits while dirty", () => {
    const state = createState();
    state.configFormMode = "form";
    state.configFormDirty = true;
    state.configForm = { gateway: { mode: "local", port: 18789 } };
    state.configRaw = "{\n}\n";

    applyConfigSnapshot(state, {
      config: { gateway: { mode: "remote", port: 9999 } },
      valid: true,
      issues: [],
      raw: '{\n  "gateway": { "mode": "remote", "port": 9999 }\n}\n',
    });

    expect(state.configRaw).toBe(
      '{\n  "gateway": {\n    "mode": "local",\n    "port": 18789\n  }\n}\n',
    );
  });

  it("updates config form when clean", () => {
    const state = createState();
    applyConfigSnapshot(state, {
      config: { gateway: { mode: "local" } },
      valid: true,
      issues: [],
      raw: "{}",
    });

    expect(state.configForm).toEqual({ gateway: { mode: "local" } });
  });

  it("sets configRawOriginal when clean for change detection", () => {
    const state = createState();
    applyConfigSnapshot(state, {
      config: { gateway: { mode: "local" } },
      valid: true,
      issues: [],
      raw: '{ "gateway": { "mode": "local" } }',
    });

    expect(state.configRawOriginal).toBe('{ "gateway": { "mode": "local" } }');
    expect(state.configFormOriginal).toEqual({ gateway: { mode: "local" } });
  });

  it("preserves configRawOriginal when dirty", () => {
    const state = createState();
    state.configFormDirty = true;
    state.configRawOriginal = '{ "original": true }';
    state.configFormOriginal = { original: true };

    applyConfigSnapshot(state, {
      config: { gateway: { mode: "local" } },
      valid: true,
      issues: [],
      raw: '{ "gateway": { "mode": "local" } }',
    });

    // Original values should be preserved when dirty
    expect(state.configRawOriginal).toBe('{ "original": true }');
    expect(state.configFormOriginal).toEqual({ original: true });
  });
});

describe("updateConfigFormValue", () => {
  it("seeds from snapshot when form is null", () => {
    const state = createState();
    state.configSnapshot = {
      config: { channels: { telegram: { botToken: "t" } }, gateway: { mode: "local" } },
      valid: true,
      issues: [],
      raw: "{}",
    };

    updateConfigFormValue(state, ["gateway", "port"], 18789);

    expect(state.configFormDirty).toBe(true);
    expect(state.configForm).toEqual({
      channels: { telegram: { botToken: "t" } },
      gateway: { mode: "local", port: 18789 },
    });
  });

  it("keeps raw in sync while editing the form", () => {
    const state = createState();
    state.configSnapshot = {
      config: { gateway: { mode: "local" } },
      valid: true,
      issues: [],
      raw: "{\n}\n",
    };

    updateConfigFormValue(state, ["gateway", "port"], 18789);

    expect(state.configRaw).toBe(
      '{\n  "gateway": {\n    "mode": "local",\n    "port": 18789\n  }\n}\n',
    );
  });
});

describe("applyConfig", () => {
  it("sends config.apply with raw and session key", async () => {
    const request = vi.fn().mockResolvedValue({});
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];
    state.applySessionKey = "agent:main:whatsapp:dm:+15555550123";
    state.configFormMode = "raw";
    state.configRaw = '{\n  agent: { workspace: "~/openclaw" }\n}\n';
    state.configSnapshot = {
      hash: "hash-123",
    };

    await applyConfig(state);

    expect(request).toHaveBeenCalledWith("config.apply", {
      raw: '{\n  agent: { workspace: "~/openclaw" }\n}\n',
      baseHash: "hash-123",
      sessionKey: "agent:main:whatsapp:dm:+15555550123",
    });
  });
});

describe("runUpdate", () => {
  it("sends update.run with session key", async () => {
    const request = vi.fn().mockResolvedValue({});
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];
    state.applySessionKey = "agent:main:whatsapp:dm:+15555550123";

    await runUpdate(state);

    expect(request).toHaveBeenCalledWith("update.run", {
      sessionKey: "agent:main:whatsapp:dm:+15555550123",
    });
  });
});

describe("applyConfigSchema", () => {
  it("applies schema to state", () => {
    const state = createState();
    const schema = { type: "object", properties: {} };
    const uiHints = { agents: { label: "Agents" } };

    applyConfigSchema(state, {
      schema,
      uiHints,
      version: "2024.1.1",
      generatedAt: "2024-01-01T00:00:00Z",
    });

    expect(state.configSchema).toBe(schema);
    expect(state.configUiHints).toEqual(uiHints);
    expect(state.configSchemaVersion).toBe("2024.1.1");
  });

  it("handles empty uiHints", () => {
    const state = createState();
    applyConfigSchema(state, {
      schema: { type: "object" },
      uiHints: {},
      version: "2024.1.1",
      generatedAt: "2024-01-01T00:00:00Z",
    });

    expect(state.configUiHints).toEqual({});
  });
});

describe("loadConfigSchema", () => {
  // Mock localStorage
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    });
  });

  afterEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.unstubAllGlobals();
  });

  it("requests schema with full=true", async () => {
    const request = vi.fn().mockResolvedValue({
      schema: { type: "object" },
      uiHints: {},
      version: "2024.1.1",
      generatedAt: "2024-01-01T00:00:00Z",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];

    await loadConfigSchema(state);

    expect(request).toHaveBeenCalledWith("config.schema", { full: true });
    expect(state.configSchema).toEqual({ type: "object" });
    expect(state.configSchemaVersion).toBe("2024.1.1");
  });

  it("sends ifNoneMatch when cached version exists", async () => {
    const request = vi.fn().mockResolvedValue({
      schema: { type: "object" },
      uiHints: {},
      version: "2024.1.2",
      generatedAt: "2024-01-01T00:00:00Z",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];
    state.configSchemaVersion = "2024.1.1"; // Cached version

    await loadConfigSchema(state);

    expect(request).toHaveBeenCalledWith("config.schema", {
      full: true,
      ifNoneMatch: "2024.1.1",
    });
  });

  it("keeps cached schema when notModified response", async () => {
    const request = vi.fn().mockResolvedValue({
      notModified: true,
      version: "2024.1.1",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];
    state.configSchemaVersion = "2024.1.1";
    state.configSchema = { type: "object", cached: true };
    state.configUiHints = { agents: { label: "Agents" } };

    await loadConfigSchema(state);

    // Schema should be unchanged
    expect(state.configSchema).toEqual({ type: "object", cached: true });
    expect(state.configUiHints).toEqual({ agents: { label: "Agents" } });
  });

  it("skips ifNoneMatch when forceRefresh=true", async () => {
    const request = vi.fn().mockResolvedValue({
      schema: { type: "object", fresh: true },
      uiHints: {},
      version: "2024.1.2",
      generatedAt: "2024-01-01T00:00:00Z",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];
    state.configSchemaVersion = "2024.1.1";

    await loadConfigSchema(state, true); // forceRefresh

    expect(request).toHaveBeenCalledWith("config.schema", { full: true });
    expect(state.configSchema).toEqual({ type: "object", fresh: true });
  });

  it("persists schema to localStorage", async () => {
    const request = vi.fn().mockResolvedValue({
      schema: { type: "object" },
      uiHints: { agents: { label: "Agents" } },
      version: "2024.1.1",
      generatedAt: "2024-01-01T00:00:00Z",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];

    await loadConfigSchema(state);

    expect(localStorage.setItem).toHaveBeenCalled();
    const stored = JSON.parse(mockStorage["openclaw:config-schema-cache"]);
    expect(stored.version).toBe("2024.1.1");
    expect(stored.schema).toEqual({ type: "object" });
  });

  it("loads from localStorage on initial load", async () => {
    mockStorage["openclaw:config-schema-cache"] = JSON.stringify({
      schema: { type: "object", fromCache: true },
      uiHints: { agents: { label: "Agents" } },
      version: "2024.1.1",
      generatedAt: "2024-01-01T00:00:00Z",
      cachedAt: Date.now(),
    });

    const request = vi.fn().mockResolvedValue({
      notModified: true,
      version: "2024.1.1",
    });
    const state = createState();
    state.connected = true;
    state.client = { request } as unknown as ConfigState["client"];

    await loadConfigSchema(state);

    // Should have loaded from localStorage first
    expect(state.configSchema).toEqual({ type: "object", fromCache: true });
  });
});

describe("clearSchemaCache", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears localStorage and state", () => {
    const state = createState();
    state.configSchema = { type: "object" };
    state.configSchemaVersion = "2024.1.1";
    state.configUiHints = { agents: { label: "Agents" } };

    clearSchemaCache(state);

    expect(localStorage.removeItem).toHaveBeenCalledWith("openclaw:config-schema-cache");
    expect(state.configSchema).toBeNull();
    expect(state.configSchemaVersion).toBeNull();
    expect(state.configUiHints).toEqual({});
  });
});
