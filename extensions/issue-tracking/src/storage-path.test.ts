import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import { resolveSharedIssueTrackingDir } from "./storage-path.js";

function createApi(pluginConfig?: Record<string, unknown>): OpenClawPluginApi {
  return {
    id: "issue-tracking",
    name: "Issue Tracking",
    source: "test",
    config: {} as OpenClawPluginApi["config"],
    pluginConfig,
    runtime: {
      state: {
        resolveStateDir: () => "/tmp/openclaw-state",
      },
    } as OpenClawPluginApi["runtime"],
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    registerTool: () => undefined,
    registerHook: () => undefined,
    registerHttpHandler: () => undefined,
    registerHttpRoute: () => undefined,
    registerChannel: () => undefined,
    registerGatewayMethod: () => undefined,
    registerCli: () => undefined,
    registerService: () => undefined,
    registerProvider: () => undefined,
    registerCommand: () => undefined,
    resolvePath: (input: string) => input,
    on: () => undefined,
  };
}

describe("resolveSharedIssueTrackingDir", () => {
  it("uses explicit workstreamId when configured", () => {
    const dir = resolveSharedIssueTrackingDir(createApi({ workstreamId: "Product Alpha" }));
    expect(dir).toContain(path.join("issue-tracking", "product-alpha-"));
  });

  it("defaults to github owner/repo when available", () => {
    const dir = resolveSharedIssueTrackingDir(
      createApi({ githubOwner: "openclaw", githubRepo: "openclaw" }),
    );
    expect(dir).toContain(path.join("issue-tracking", "openclaw-openclaw-"));
  });
});
