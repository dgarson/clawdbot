import { describe, expect, test, vi } from "vitest";
import { listGatewayMethods } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";

const listChannelPlugins = vi.hoisted(() => vi.fn());

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins,
}));

describe("listGatewayMethods", () => {
  test("includes all core handlers and channel methods", () => {
    listChannelPlugins.mockReturnValue([{ id: "mock", gatewayMethods: ["channel.mock"] }]);
    const methods = listGatewayMethods();
    const methodSet = new Set(methods);
    const missing = Object.keys(coreGatewayHandlers).filter((method) => !methodSet.has(method));

    expect(missing).toEqual([]);
    expect(methodSet.has("channel.mock")).toBe(true);
  });

  test("includes overseer alias methods during migration", () => {
    listChannelPlugins.mockReturnValue([]);
    const methods = listGatewayMethods();
    const methodSet = new Set(methods);

    expect(coreGatewayHandlers["overseer.goal.create"]).toBeDefined();
    expect(coreGatewayHandlers["overseer.goals.create"]).toBeDefined();
    expect(methodSet.has("overseer.goal.list")).toBe(true);
    expect(methodSet.has("overseer.goals.list")).toBe(true);
  });
});
