import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PolicySelectRow, PolicyToggleRow } from "./ExecApprovalsPolicyRow";

const OPTIONS = [
  { value: "deny", label: "Deny" },
  { value: "allowlist", label: "Allowlist" },
  { value: "full", label: "Full" },
];

describe("PolicySelectRow", () => {
  it("displays effective value when not editing", () => {
    const { container } = render(
      <PolicySelectRow
        label="Security"
        description="Default security mode"
        value={undefined}
        defaultValue="deny"
        options={OPTIONS}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    expect(container.textContent).toContain("Security");
    expect(container.textContent).toContain("Deny");
    expect(container.textContent).toContain("Default security mode");
  });

  it("shows inherited badge when value is undefined", () => {
    const { container } = render(
      <PolicySelectRow
        label="Security"
        description="test"
        value={undefined}
        defaultValue="deny"
        options={OPTIONS}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    // Should show InheritedBadge which contains "default" text
    expect(container.textContent).toContain("default");
  });

  it("shows override value with full opacity when set", () => {
    const { container } = render(
      <PolicySelectRow
        label="Security"
        description="test"
        value="full"
        defaultValue="deny"
        options={OPTIONS}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    expect(container.textContent).toContain("Full");
    // Should NOT show inherited badge
    expect(container.textContent).not.toContain("default");
  });

  it("renders a select when editing", () => {
    const { container } = render(
      <PolicySelectRow
        label="Security"
        description="test"
        value={undefined}
        defaultValue="deny"
        options={OPTIONS}
        onChange={vi.fn()}
        editing={true}
      />,
    );
    // Should have a select trigger button
    const trigger = container.querySelector("[data-slot='select-trigger']");
    expect(trigger).not.toBeNull();
  });
});

describe("PolicyToggleRow", () => {
  it("displays label and description", () => {
    const { container } = render(
      <PolicyToggleRow
        label="Auto-allow"
        description="Allow skill executables"
        value={undefined}
        defaultValue={false}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    expect(container.textContent).toContain("Auto-allow");
    expect(container.textContent).toContain("Allow skill executables");
  });

  it("shows inherited badge when value is undefined", () => {
    const { container } = render(
      <PolicyToggleRow
        label="Auto-allow"
        description="test"
        value={undefined}
        defaultValue={false}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    // Should contain InheritedBadge text
    expect(container.textContent).toContain("default");
  });

  it("does not show inherited badge when value is set", () => {
    const { container } = render(
      <PolicyToggleRow
        label="Auto-allow"
        description="test"
        value={true}
        defaultValue={false}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    expect(container.textContent).not.toContain("default");
  });

  it("renders a switch element", () => {
    const { container } = render(
      <PolicyToggleRow
        label="Auto-allow"
        description="test"
        value={false}
        defaultValue={false}
        onChange={vi.fn()}
        editing={true}
      />,
    );
    // Switch renders as a button with role=switch
    const switchEl = container.querySelector("[role='switch']");
    expect(switchEl).not.toBeNull();
  });

  it("switch is disabled when not editing", () => {
    const { container } = render(
      <PolicyToggleRow
        label="Auto-allow"
        description="test"
        value={false}
        defaultValue={false}
        onChange={vi.fn()}
        editing={false}
      />,
    );
    const switchEl = container.querySelector("[role='switch']");
    expect(switchEl).not.toBeNull();
    expect(switchEl?.hasAttribute("disabled") || switchEl?.getAttribute("data-disabled") !== null).toBe(true);
  });
});
