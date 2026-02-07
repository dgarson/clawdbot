import { describe, expect, it } from "vitest";
import {
  renderConfigPreview,
  renderModeBadge,
  renderModeToggleHint,
  renderNavBar,
  renderPhaseBanner,
  renderSecurityWarningAdvanced,
  renderSecurityWarningRegular,
  renderSummaryCard,
} from "./onboarding-style.js";

describe("renderPhaseBanner", () => {
  it("includes the title and step number", () => {
    const output = renderPhaseBanner({
      title: "Your Bot",
      stepNumber: 2,
      totalSteps: 5,
    });
    expect(output).toContain("Your Bot");
    expect(output).toContain("2");
    expect(output).toContain("5");
  });

  it("includes subtitle when provided", () => {
    const output = renderPhaseBanner({
      title: "Identity",
      subtitle: "Configure workspace and model",
      stepNumber: 2,
      totalSteps: 5,
    });
    expect(output).toContain("Configure workspace and model");
  });
});

describe("renderSummaryCard", () => {
  it("includes title and all entries", () => {
    const output = renderSummaryCard({
      title: "Identity",
      entries: [
        { label: "Workspace", value: "/home/user" },
        { label: "Model", value: "claude-3-opus" },
      ],
    });
    expect(output).toContain("Identity");
    expect(output).toContain("Workspace");
    expect(output).toContain("/home/user");
    expect(output).toContain("Model");
    expect(output).toContain("claude-3-opus");
  });

  it("shows skipped status", () => {
    const output = renderSummaryCard({
      title: "Skills",
      entries: [],
      status: "skipped",
    });
    expect(output).toContain("Skills");
    // Should contain some indication of skipped status
    expect(output.toLowerCase()).toContain("skip");
  });
});

describe("renderModeBadge", () => {
  it("returns Regular badge for regular mode", () => {
    const output = renderModeBadge("regular");
    expect(output).toContain("Regular");
  });

  it("returns Advanced badge for advanced mode", () => {
    const output = renderModeBadge("advanced");
    expect(output).toContain("Advanced");
  });
});

describe("renderModeToggleHint", () => {
  it("suggests Advanced when in regular mode", () => {
    const output = renderModeToggleHint("regular");
    expect(output).toContain("Advanced");
  });

  it("suggests Regular when in advanced mode", () => {
    const output = renderModeToggleHint("advanced");
    expect(output).toContain("Regular");
  });
});

describe("renderNavBar", () => {
  it("includes next label", () => {
    const output = renderNavBar({
      canGoBack: false,
      nextLabel: "Continue",
      modeLabel: "Regular",
    });
    expect(output).toContain("Continue");
  });

  it("includes back when canGoBack is true", () => {
    const output = renderNavBar({
      canGoBack: true,
      nextLabel: "Next",
      modeLabel: "Regular",
    });
    expect(output).toContain("Back");
  });

  it("does not include back when canGoBack is false", () => {
    // In non-rich mode, should not have Back
    process.env.NO_COLOR = "1";
    const output = renderNavBar({
      canGoBack: false,
      nextLabel: "Next",
      modeLabel: "Regular",
    });
    expect(output).not.toContain("[Back]");
    delete process.env.NO_COLOR;
  });
});

describe("renderSecurityWarningRegular", () => {
  it("is shorter than the advanced warning", () => {
    const regular = renderSecurityWarningRegular();
    const advanced = renderSecurityWarningAdvanced();
    expect(regular.length).toBeLessThan(advanced.length);
  });

  it("includes key safety measures", () => {
    const output = renderSecurityWarningRegular();
    expect(output).toContain("trusted contacts");
    expect(output).toContain("sensitive files");
    expect(output).toContain("strongest AI model");
  });
});

describe("renderSecurityWarningAdvanced", () => {
  it("includes technical details", () => {
    const output = renderSecurityWarningAdvanced();
    expect(output).toContain("Pairing/allowlists");
    expect(output).toContain("Sandbox");
    expect(output).toContain("security audit");
  });
});

describe("renderConfigPreview", () => {
  it("includes all section titles and entries", () => {
    const output = renderConfigPreview([
      {
        title: "Identity",
        entries: [{ label: "Workspace", value: "/home/user" }],
      },
      {
        title: "Gateway",
        entries: [{ label: "Port", value: "18789" }],
      },
    ]);
    expect(output).toContain("Identity");
    expect(output).toContain("Workspace");
    expect(output).toContain("/home/user");
    expect(output).toContain("Gateway");
    expect(output).toContain("Port");
    expect(output).toContain("18789");
    expect(output).toContain("Configuration Preview");
  });
});
