import { beforeEach, describe, expect, it, vi } from "vitest";

let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import "./test-helpers/fast-core-tools.js";
import { createOpenClawTools } from "./openclaw-tools.js";

describe("agents_list", () => {
  type AgentConfig = NonNullable<NonNullable<typeof configOverride.agents>["list"]>[number];

  function setConfigWithAgentList(agentList: AgentConfig[]) {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: agentList,
      },
    };
  }

  function requireAgentsListTool() {
    const tool = createOpenClawTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }
    return tool;
  }

  function readAgentList(result: unknown) {
    return (result as { details?: { agents?: Array<{ id: string; configured?: boolean }> } })
      .details?.agents;
  }

  beforeEach(() => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("defaults to the requester agent only", async () => {
    const tool = requireAgentsListTool();
    const result = await tool.execute("call1", {});
    expect(result.details).toMatchObject({
      requester: "main",
      allowAny: false,
    });
    const agents = readAgentList(result);
    expect(agents?.map((agent) => agent.id)).toEqual(["main"]);
  });

  it("includes allowlisted targets plus requester", async () => {
    setConfigWithAgentList([
      {
        id: "main",
        name: "Main",
        subagents: {
          allowAgents: ["research"],
        },
      },
      {
        id: "research",
        name: "Research",
      },
    ]);

    const tool = requireAgentsListTool();
    const result = await tool.execute("call2", {});
    const agents = readAgentList(result);
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "research"]);
  });

  it("returns configured agents when allowlist is *", async () => {
    setConfigWithAgentList([
      {
        id: "main",
        subagents: {
          allowAgents: ["*"],
        },
      },
      {
        id: "research",
        name: "Research",
      },
      {
        id: "coder",
        name: "Coder",
      },
    ]);

    const tool = requireAgentsListTool();
    const result = await tool.execute("call3", {});
    expect(result.details).toMatchObject({
      allowAny: true,
    });
    const agents = readAgentList(result);
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "coder", "research"]);
  });

  it("marks requested model capability by matching each target agent subagent model", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          model: { primary: "anthropic/claude-opus-4-6" },
        },
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["research", "writer"],
            },
          },
          {
            id: "research",
            subagents: {
              model: "minimax/minimax-m2.5",
            },
          },
          {
            id: "writer",
            subagents: {
              model: "anthropic/claude-sonnet-4-5",
            },
          },
        ],
      },
    };

    const tool = createOpenClawTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call5", { model: "minimax/minimax-m2.5" });
    expect(result.details).toMatchObject({
      requestedModel: {
        provider: "minimax",
        model: "minimax-m2.5",
      },
    });

    const agents = (
      result.details as { agents?: Array<{ id: string; capableForRequestedModel?: boolean }> }
    ).agents;
    expect(agents?.find((agent) => agent.id === "research")?.capableForRequestedModel).toBe(true);
    expect(agents?.find((agent) => agent.id === "writer")?.capableForRequestedModel).toBe(false);
  });

  it("supports provider-only capability checks", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        list: [
          {
            id: "main",
            subagents: {
              allowAgents: ["research", "writer"],
            },
          },
          {
            id: "research",
            subagents: {
              model: "minimax/minimax-m2.5",
            },
          },
          {
            id: "writer",
            subagents: {
              model: "anthropic/claude-sonnet-4-5",
            },
          },
        ],
      },
    };

    const tool = createOpenClawTools({
      agentSessionKey: "main",
    }).find((candidate) => candidate.name === "agents_list");
    if (!tool) {
      throw new Error("missing agents_list tool");
    }

    const result = await tool.execute("call6", { model: "minimax" });
    const agents = (
      result.details as { agents?: Array<{ id: string; capableForRequestedModel?: boolean }> }
    ).agents;
    expect(agents?.find((agent) => agent.id === "research")?.capableForRequestedModel).toBe(true);
    expect(agents?.find((agent) => agent.id === "writer")?.capableForRequestedModel).toBe(false);
  });

  it("marks allowlisted-but-unconfigured agents", async () => {
    setConfigWithAgentList([
      {
        id: "main",
        subagents: {
          allowAgents: ["research"],
        },
      },
    ]);

    const tool = requireAgentsListTool();
    const result = await tool.execute("call4", {});
    const agents = readAgentList(result);
    expect(agents?.map((agent) => agent.id)).toEqual(["main", "research"]);
    const research = agents?.find((agent) => agent.id === "research");
    expect(research?.configured).toBe(false);
  });
});
