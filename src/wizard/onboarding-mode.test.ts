import { describe, expect, it } from "vitest";
import { createModeState, FRIENDLY_LABELS } from "./onboarding-mode.js";

describe("createModeState", () => {
  it("defaults to regular mode", () => {
    const state = createModeState();
    expect(state.mode).toBe("regular");
    expect(state.isRegular()).toBe(true);
    expect(state.isAdvanced()).toBe(false);
  });

  it("can be initialized to advanced mode", () => {
    const state = createModeState("advanced");
    expect(state.mode).toBe("advanced");
    expect(state.isAdvanced()).toBe(true);
    expect(state.isRegular()).toBe(false);
  });

  it("toggle switches between modes", () => {
    const state = createModeState("regular");
    expect(state.mode).toBe("regular");

    const newMode = state.toggle();
    expect(newMode).toBe("advanced");
    expect(state.mode).toBe("advanced");

    const backMode = state.toggle();
    expect(backMode).toBe("regular");
    expect(state.mode).toBe("regular");
  });

  it("label returns regular labels in regular mode", () => {
    const state = createModeState("regular");
    expect(state.label("gateway.title")).toBe("Bot Server");
    expect(state.label("gateway.port")).toBe("Server port");
    expect(state.label("gateway.bind")).toBe("Who can connect");
  });

  it("label returns advanced labels in advanced mode", () => {
    const state = createModeState("advanced");
    expect(state.label("gateway.title")).toBe("Gateway");
    expect(state.label("gateway.port")).toBe("Gateway port");
    expect(state.label("gateway.bind")).toBe("Gateway bind");
  });

  it("label returns key for unknown keys", () => {
    const state = createModeState("regular");
    expect(state.label("unknown.key")).toBe("unknown.key");
  });

  it("label reflects mode changes after toggle", () => {
    const state = createModeState("regular");
    expect(state.label("gateway.title")).toBe("Bot Server");

    state.toggle();
    expect(state.label("gateway.title")).toBe("Gateway");
  });
});

describe("FRIENDLY_LABELS", () => {
  it("has entries for all key UI sections", () => {
    const requiredKeys = [
      "gateway.title",
      "gateway.port",
      "gateway.bind",
      "gateway.auth",
      "workspace.title",
      "auth.title",
      "channels.title",
      "skills.title",
      "hooks.title",
      "launch.title",
      "security.title",
      "flow.title",
    ];
    for (const key of requiredKeys) {
      expect(FRIENDLY_LABELS[key]).toBeDefined();
      expect(FRIENDLY_LABELS[key].regular).toBeTruthy();
      expect(FRIENDLY_LABELS[key].advanced).toBeTruthy();
    }
  });

  it("regular and advanced labels differ for key terms", () => {
    // Gateway should be friendlier in regular mode
    expect(FRIENDLY_LABELS["gateway.title"].regular).not.toBe(
      FRIENDLY_LABELS["gateway.title"].advanced,
    );
    // Skills should be friendlier in regular mode
    expect(FRIENDLY_LABELS["skills.title"].regular).not.toBe(
      FRIENDLY_LABELS["skills.title"].advanced,
    );
    // Hooks should be friendlier in regular mode
    expect(FRIENDLY_LABELS["hooks.title"].regular).not.toBe(
      FRIENDLY_LABELS["hooks.title"].advanced,
    );
  });

  it("bind mode labels differ between regular and advanced", () => {
    expect(FRIENDLY_LABELS["bind.loopback"].regular).toBe("This computer only");
    expect(FRIENDLY_LABELS["bind.loopback"].advanced).toBe("Loopback (127.0.0.1)");
  });
});
