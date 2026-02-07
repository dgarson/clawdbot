import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InheritedValue, InheritedBadge } from "./InheritedValue";

describe("InheritedValue", () => {
  it("renders value with full opacity when not inherited", () => {
    const { container } = render(
      <InheritedValue value="deny" inherited={false} />,
    );
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("deny");
    expect(span?.className).toContain("font-medium");
  });

  it("renders value with muted style and arrow icon when inherited", () => {
    const { container } = render(
      <InheritedValue value="deny" inherited={true} source="defaults" />,
    );
    // Should contain the value text
    expect(container.textContent).toContain("deny");
    // Should have an SVG icon (arrow-down-from-line)
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("does not show arrow icon when not inherited", () => {
    const { container } = render(
      <InheritedValue value="deny" inherited={false} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("InheritedBadge", () => {
  it("renders with default source text", () => {
    const { container } = render(<InheritedBadge />);
    expect(container.textContent).toContain("default");
  });

  it("renders with custom source text", () => {
    const { container } = render(<InheritedBadge source="gateway" />);
    expect(container.textContent).toContain("gateway");
  });

  it("contains an arrow icon", () => {
    const { container } = render(<InheritedBadge />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
