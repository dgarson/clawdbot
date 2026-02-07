import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { NodeCard } from "./NodeCard";
import type { NodeEntry } from "@/lib/api/nodes";

const baseNode: NodeEntry = {
  nodeId: "test-node",
  displayName: "Test Node",
  platform: "darwin",
  version: "2025.1.15",
  caps: ["exec", "fs"],
  commands: ["system.run", "system.execApprovals.get"],
  paired: true,
  connected: true,
  connectedAtMs: Date.now(),
};

describe("NodeCard", () => {
  it("renders display name and platform", () => {
    const { container } = render(<NodeCard node={baseNode} />);
    expect(container.textContent).toContain("Test Node");
    expect(container.textContent).toContain("darwin");
    expect(container.textContent).toContain("v2025.1.15");
  });

  it("falls back to nodeId when no displayName", () => {
    const { container } = render(
      <NodeCard node={{ ...baseNode, displayName: undefined }} />,
    );
    expect(container.textContent).toContain("test-node");
  });

  it("shows Online badge when connected", () => {
    const { container } = render(<NodeCard node={baseNode} />);
    expect(container.textContent).toContain("Online");
  });

  it("shows Offline badge when disconnected", () => {
    const { container } = render(
      <NodeCard node={{ ...baseNode, connected: false }} />,
    );
    expect(container.textContent).toContain("Offline");
  });

  it("renders capability badges", () => {
    const { container } = render(<NodeCard node={baseNode} />);
    expect(container.textContent).toContain("exec");
    expect(container.textContent).toContain("fs");
  });

  it("shows command count", () => {
    const { container } = render(<NodeCard node={baseNode} />);
    expect(container.textContent).toContain("2 commands");
  });

  it("shows singular command text for 1 command", () => {
    const { container } = render(
      <NodeCard node={{ ...baseNode, commands: ["system.run"] }} />,
    );
    expect(container.textContent).toContain("1 command");
    expect(container.textContent).not.toContain("1 commands");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container } = render(
      <NodeCard node={baseNode} onClick={onClick} />,
    );
    container.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies selected styles when selected", () => {
    const { container } = render(
      <NodeCard node={baseNode} selected={true} />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-primary");
  });
});
