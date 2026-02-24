import { describe, expect, it } from "vitest";
import {
  buildAlertCenterQuery,
  getAlertStatusLabel,
  getRovingTargetIndex,
  parseAlertCenterQuery,
  resolveBackToAlert,
  resolveRuleJump,
} from "./alert-center-utils";

describe("alert-center-utils", () => {
  it("parses and rebuilds alert center query state", () => {
    const parsed = parseAlertCenterQuery("?tab=rules&status=firing&severity=high&category=provider&alert=al-1&rule=rule-1&fromAlert=al-1");
    expect(parsed).toEqual({
      tab: "rules",
      status: "firing",
      severity: "high",
      category: "provider",
      alertId: "al-1",
      ruleId: "rule-1",
      fromAlertId: "al-1",
    });

    const rebuilt = buildAlertCenterQuery("", parsed);
    expect(rebuilt).toBe("?tab=rules&status=firing&severity=high&category=provider&alert=al-1&rule=rule-1&fromAlert=al-1");
  });

  it("drops empty query values when writing", () => {
    const query = buildAlertCenterQuery("?tab=alerts&status=resolved", {
      tab: "alerts",
      status: "",
      severity: undefined,
    });
    expect(query).toBe("?tab=alerts");
  });

  it("maps status labels with safe fallback", () => {
    expect(getAlertStatusLabel("acknowledged")).toBe("Ack'd");
    expect(getAlertStatusLabel("custom-state")).toBe("custom-state");
  });

  it("supports roving focus keyboard navigation", () => {
    expect(getRovingTargetIndex(0, "ArrowRight", 4)).toBe(1);
    expect(getRovingTargetIndex(0, "ArrowLeft", 4)).toBe(3);
    expect(getRovingTargetIndex(2, "Home", 4)).toBe(0);
    expect(getRovingTargetIndex(1, "End", 4)).toBe(3);
    expect(getRovingTargetIndex(1, "Enter", 4)).toBeNull();
  });

  it("handles alert-to-rule navigation state transitions", () => {
    expect(resolveRuleJump("al-1", "rule-2")).toEqual({
      tab: "rules",
      focusedRuleId: "rule-2",
      originAlertId: "al-1",
    });

    expect(resolveBackToAlert("al-1", ["al-1", "al-2"])).toEqual({
      tab: "alerts",
      selectedAlertId: "al-1",
      originAlertId: null,
      focusedRuleId: null,
    });

    expect(resolveBackToAlert("missing", ["al-1", "al-2"]).selectedAlertId).toBeNull();
  });
});
