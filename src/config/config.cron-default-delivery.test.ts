import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./config.js";

describe("cron default delivery config", () => {
  it("accepts cron.defaultDelivery settings", () => {
    const res = validateConfigObject({
      cron: {
        defaultDelivery: {
          enabled: false,
          mode: "announce",
          channel: "slack",
          to: "C123",
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects invalid cron.defaultDelivery mode", () => {
    const res = validateConfigObject({
      cron: {
        defaultDelivery: {
          enabled: true,
          mode: "broadcast",
        },
      },
    });

    expect(res.ok).toBe(false);
  });
});
