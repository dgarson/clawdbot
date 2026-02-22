import { describe, it, expect } from "vitest";
import { actionRequiresTarget } from "./message-action-spec.js";

describe("actionRequiresTarget", () => {
  it("returns true for actions that need a 'to' target", () => {
    expect(actionRequiresTarget("send")).toBe(true);
    expect(actionRequiresTarget("read")).toBe(true);
    expect(actionRequiresTarget("react")).toBe(true);
  });

  it("returns true for actions that need a channelId target", () => {
    expect(actionRequiresTarget("channel-info")).toBe(true);
    expect(actionRequiresTarget("channel-edit")).toBe(true);
    expect(actionRequiresTarget("channel-delete")).toBe(true);
  });

  it("returns false for actions that need no target", () => {
    expect(actionRequiresTarget("broadcast")).toBe(false);
    expect(actionRequiresTarget("channel-list")).toBe(false);
    expect(actionRequiresTarget("search")).toBe(false);
    expect(actionRequiresTarget("thread-list")).toBe(false);
  });

  it("returns false for unknown action names instead of a misleading target error", () => {
    // 'list-channels' is not a valid action (correct name is 'channel-list').
    // Unknown actions should NOT say they "require a target" — that produces a confusing
    // error message that hides the real problem (the action name is wrong).
    expect(actionRequiresTarget("list-channels" as never)).toBe(false);
    expect(actionRequiresTarget("send-message" as never)).toBe(false);
  });
});
