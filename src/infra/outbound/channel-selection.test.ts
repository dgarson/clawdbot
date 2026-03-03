import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChannelPlugin } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import {
  createChannelTestPluginBase,
  createTestRegistry,
} from "../../test-utils/channel-plugins.js";
import { resolveMessageChannelSelection } from "./channel-selection.js";

const emptyRegistry = createTestRegistry([]);

const slackPlugin: ChannelPlugin = {
  ...createChannelTestPluginBase({ id: "slack", label: "Slack" }),
};

describe("resolveMessageChannelSelection", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([{ pluginId: "slack", plugin: slackPlugin, source: "test" }]),
    );
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("accepts built-in provider labels as channel hints", async () => {
    const selection = await resolveMessageChannelSelection({
      cfg: {} as OpenClawConfig,
      channel: "Slack",
    });
    expect(selection.channel).toBe("slack");
  });

  it("returns informative error when destination is passed as channel", async () => {
    await expect(
      resolveMessageChannelSelection({
        cfg: {} as OpenClawConfig,
        channel: "cb-inbox",
      }),
    ).rejects.toThrow(/destination name\/ID.*target/i);
  });
});
