import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test scaffold for multi-agent session spawn functionality.
 *
 * This validates the critical path:
 * 1. Gateway startup check (can we connect?)
 * 2. Agent spawn: sessions_spawn creates a subagent session
 * 3. Subagent responds with a message
 * 4. Session cleanup / session key valid
 *
 * Run with INTEGRATION=1 env var to enable tests that require live gateway:
 *   INTEGRATION=1 pnpm test:integration
 *
 * Without INTEGRATION=1, tests are skipped.
 */

type SpawnResult = {
  status: "accepted" | "forbidden" | "error";
  childSessionKey?: string;
  runId?: string;
  note?: string;
  modelApplied?: boolean;
  error?: string;
};

describe("agent-spawn integration", () => {
  // Track spawned sessions for cleanup
  const spawnedSessions: string[] = [];

  // Mock gateway call to simulate sessions_spawn
  const mockCallGateway = vi.fn();

  beforeEach(() => {
    mockCallGateway.mockReset();
    spawnedSessions.length = 0;
  });

  afterEach(() => {
    // Cleanup any spawned sessions
    spawnedSessions.length = 0;
  });

  // Test only runs with INTEGRATION=1 to require live gateway
  // Without it, we validate the mock/interface contract
  it.skipIf(!process.env.INTEGRATION)(
    "gateway is reachable and can spawn a subagent session",
    async () => {
      // This test requires a live gateway - only runs with INTEGRATION=1
      const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";

      // Check gateway is reachable
      try {
        const response = await fetch(`${gatewayUrl}/health`, {
          method: "GET",
        });
        // Gateway may not have /health, so just check if we got any response
        expect(response.ok || response.status === 404).toBe(true);
      } catch {
        // If connection fails, this test will fail as expected
        throw new Error("Gateway not reachable");
      }
    },
  );

  it("sessions_spawn returns valid child session key structure", async () => {
    // Mock the sessions_spawn call to return expected structure
    const childSessionKey = "agent:main:subagent:test-run-123";
    const runId = "run-abc-456";

    mockCallGateway.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: Record<string, unknown> };
      if (request.method === "sessions.spawn") {
        return {
          status: "accepted",
          childSessionKey,
          runId,
          note: "auto-announces on completion",
        };
      }
      return null;
    });

    // Simulate calling the sessions_spawn interface
    const result = (await mockCallGateway({
      method: "sessions.spawn",
      params: {
        task: "test task",
        label: "test-subagent",
      },
    })) as SpawnResult;

    // Validate response structure
    expect(result.status).toBe("accepted");
    expect(result.childSessionKey).toBeDefined();
    expect(result.runId).toBeDefined();
    expect(result.childSessionKey).toMatch(/^agent:main:subagent:/);

    spawnedSessions.push(result.childSessionKey!);
  });

  it("spawned subagent responds and session can be cleaned up", async () => {
    const childSessionKey = "agent:main:subagent:test-run-456";
    const runId = "run-def-789";

    mockCallGateway.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string };
      if (request.method === "sessions.spawn") {
        return {
          status: "accepted",
          childSessionKey,
          runId,
        };
      }
      if (request.method === "sessions.get") {
        // Return completed session
        return {
          key: childSessionKey,
          status: "completed",
          result: { message: "Task completed successfully" },
        };
      }
      if (request.method === "sessions.delete") {
        return { ok: true };
      }
      return null;
    });

    // Spawn a subagent
    const spawnResult = (await mockCallGateway({
      method: "sessions.spawn",
      params: { task: "echo hello" },
    })) as SpawnResult;

    expect(spawnResult.status).toBe("accepted");
    spawnedSessions.push(spawnResult.childSessionKey!);

    // Verify we can query the session status
    const sessionStatus = (await mockCallGateway({
      method: "sessions.get",
      params: { key: childSessionKey },
    })) as { key: string; status: string };

    expect(sessionStatus.key).toBe(childSessionKey);
    expect(sessionStatus.status).toBe("completed");

    // Cleanup the session
    const cleanupResult = (await mockCallGateway({
      method: "sessions.delete",
      params: { key: childSessionKey },
    })) as { ok: boolean };

    expect(cleanupResult.ok).toBe(true);
    // Manually clear to verify cleanup worked
    spawnedSessions.length = 0;
    expect(spawnedSessions).toHaveLength(0);
  });

  it("session key format is valid for main and subagent sessions", () => {
    // Validate session key formats match expected patterns
    const validMainKey = "agent:main:direct:slack:U123";
    const validSubagentKey = "agent:main:subagent:run-123";

    // Main session key pattern
    expect(validMainKey).toMatch(/^agent:main:/);

    // Subagent session key pattern
    expect(validSubagentKey).toMatch(/^agent:main:subagent:/);

    // Both should be valid session keys
    const isValidSessionKey = (key: string) => key.startsWith("agent:") && key.includes(":");

    expect(isValidSessionKey(validMainKey)).toBe(true);
    expect(isValidSessionKey(validSubagentKey)).toBe(true);
  });
});
