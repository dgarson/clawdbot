import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("config schema regressions", () => {
  it("accepts nested telegram groupPolicy overrides", () => {
    const res = validateConfigObject({
      channels: {
        telegram: {
          groups: {
            "-1001234567890": {
              groupPolicy: "open",
              topics: {
                "42": {
                  groupPolicy: "disabled",
                },
              },
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it('accepts memorySearch fallback "voyage"', () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          memorySearch: {
            fallback: "voyage",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it('accepts memorySearch provider "mistral"', () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          memorySearch: {
            provider: "mistral",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts safe iMessage remoteHost", () => {
    const res = validateConfigObject({
      channels: {
        imessage: {
          remoteHost: "bot@gateway-host",
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts channels.whatsapp.enabled", () => {
    const res = validateConfigObject({
      channels: {
        whatsapp: {
          enabled: true,
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects unsafe iMessage remoteHost", () => {
    const res = validateConfigObject({
      channels: {
        imessage: {
          remoteHost: "bot@gateway-host -oProxyCommand=whoami",
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0]?.path).toBe("channels.imessage.remoteHost");
    }
  });

  it("accepts iMessage attachment root patterns", () => {
    const res = validateConfigObject({
      channels: {
        imessage: {
          attachmentRoots: ["/Users/*/Library/Messages/Attachments"],
          remoteAttachmentRoots: ["/Volumes/relay/attachments"],
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts string values for agents defaults model inputs", () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          model: "anthropic/claude-opus-4-6",
          imageModel: "openai/gpt-4.1-mini",
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects relative iMessage attachment roots", () => {
    const res = validateConfigObject({
      channels: {
        imessage: {
          attachmentRoots: ["./attachments"],
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0]?.path).toBe("channels.imessage.attachmentRoots.0");
    }
  });

  it("accepts sessionLabels config in agent defaults", () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          sessionLabels: {
            enabled: true,
            model: "anthropic/claude-haiku-4-5",
            maxLength: 79,
            prompt: "Generate a short session title",
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects sessionLabels.maxLength above schema limit", () => {
    const res = validateConfigObject({
      agents: {
        defaults: {
          sessionLabels: {
            enabled: true,
            maxLength: 80,
          },
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0]?.path).toBe("agents.defaults.sessionLabels.maxLength");
    }
  });

  it("accepts approvals.hitl policy escalation and boundary settings", () => {
    const res = validateConfigObject({
      approvals: {
        hitl: {
          defaultPolicyId: "default",
          approverRoleOrder: ["viewer", "operator", "admin", "owner"],
          policies: [
            {
              id: "default",
              pattern: "nodes.*",
              minApproverRole: "admin",
              requireDifferentActor: true,
              maxApprovalChainDepth: 2,
              escalation: {
                onDeny: "owner",
                onTimeout: "owner",
                maxEscalations: 3,
              },
            },
          ],
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects approvals.hitl negative escalation limits", () => {
    const res = validateConfigObject({
      approvals: {
        hitl: {
          policies: [
            {
              id: "default",
              tool: "nodes.run",
              escalation: {
                onDeny: "owner",
                maxEscalations: -1,
              },
            },
          ],
        },
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues[0]?.path).toBe("approvals.hitl.policies.0.escalation.maxEscalations");
    }
  });
});
