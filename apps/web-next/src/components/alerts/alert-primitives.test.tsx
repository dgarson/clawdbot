import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AlertGroupPresetButtons,
  AlertRuleStatsRail,
  AlertSeveritySummaryPill,
} from "./AlertRuleCardPrimitives";
import { AlertFilterPillGroup } from "./AlertFilters";
import { validateSeverityBadgeContrast } from "./alertVisualA11y";

describe("alert primitives", () => {
  it("renders severity summary pill with accessibility-friendly controls", () => {
    const html = renderToStaticMarkup(
      <AlertSeveritySummaryPill
        label="Critical"
        total={3}
        activeCount={2}
        expanded
        onToggle={() => {}}
      />
    );

    expect(html).toContain("data-severity-pill");
    expect(html).toContain("Critical");
    expect(html).toContain(">3<");
  });

  it("renders rule stats rail values", () => {
    const html = renderToStaticMarkup(
      <AlertRuleStatsRail
        stats={[
          { label: "Window", value: "5m" },
          { label: "Threshold", value: "80%" },
        ]}
      />
    );
    expect(html).toContain("Window");
    expect(html).toContain("5m");
    expect(html).toContain("Threshold");
  });

  it("renders reusable preset controls", () => {
    const html = renderToStaticMarkup(
      <AlertGroupPresetButtons
        onP1Only={() => {}}
        onExpandAll={() => {}}
        onCollapseAll={() => {}}
      />
    );
    expect(html).toContain("Suggested: P0/P1 only");
    expect(html).toContain("Expand all");
    expect(html).toContain("Collapse all");
  });

  it("renders pill filter group semantics", () => {
    const html = renderToStaticMarkup(
      <AlertFilterPillGroup
        label="State"
        value="all"
        onChange={() => {}}
        options={[
          { value: "all", label: "All" },
          { value: "firing", label: "Firing" },
        ]}
      />
    );
    expect(html).toContain('aria-label="Filter by state"');
    expect(html).toContain("data-filter-pill");
  });

  it("passes severity badge contrast check", () => {
    expect(validateSeverityBadgeContrast()).toEqual([]);
  });
});

