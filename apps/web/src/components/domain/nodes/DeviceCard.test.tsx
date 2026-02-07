import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DeviceCard } from "./DeviceCard";
import type { PairedDevice } from "@/lib/api/nodes";

const baseDevice: PairedDevice = {
  deviceId: "dd5d7b46ea89126d3944b4d9a35f3cf138c79b282ba7665f5b50f61e4a495bd1",
  displayName: "Operator Device",
  roles: ["operator"],
  scopes: ["operator.admin", "operator.approvals"],
  tokens: [
    {
      role: "operator",
      scopes: ["operator.admin"],
      createdAtMs: Date.now() - 86400000,
      active: true,
    },
  ],
  approvedAtMs: Date.now() - 259200000,
};

describe("DeviceCard", () => {
  it("renders device display name", () => {
    const { container } = render(
      <DeviceCard
        device={baseDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Operator Device");
  });

  it("truncates long device IDs", () => {
    const { container } = render(
      <DeviceCard
        device={baseDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    // Should not show the full 64-char ID
    expect(container.textContent).not.toContain(baseDevice.deviceId);
    // Should show truncated form
    expect(container.textContent).toContain("dd5d7b46");
  });

  it("renders role badges", () => {
    const { container } = render(
      <DeviceCard
        device={baseDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("operator");
  });

  it("renders scope badges", () => {
    const { container } = render(
      <DeviceCard
        device={baseDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("operator.admin");
    expect(container.textContent).toContain("operator.approvals");
  });

  it("renders active token info", () => {
    const { container } = render(
      <DeviceCard
        device={baseDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    // Should show "active" badge and the token role
    expect(container.textContent).toContain("active");
    expect(container.textContent).toContain("Tokens");
  });

  it("falls back to truncated ID when no displayName", () => {
    const noNameDevice = { ...baseDevice, displayName: undefined };
    const { container } = render(
      <DeviceCard
        device={noNameDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    // Should show truncated ID as the title
    expect(container.textContent).toContain("dd5d7b46");
  });

  it("hides tokens section when no active tokens", () => {
    const noTokenDevice = { ...baseDevice, tokens: [] };
    const { container } = render(
      <DeviceCard
        device={noTokenDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    expect(container.textContent).not.toContain("Tokens");
  });

  it("filters out revoked tokens", () => {
    const revokedDevice = {
      ...baseDevice,
      tokens: [
        {
          role: "operator",
          createdAtMs: Date.now() - 86400000,
          revokedAtMs: Date.now() - 3600000,
          active: false,
        },
      ],
    };
    const { container } = render(
      <DeviceCard
        device={revokedDevice}
        onRotateToken={vi.fn()}
        onRevokeToken={vi.fn()}
      />,
    );
    expect(container.textContent).not.toContain("Tokens");
  });
});
