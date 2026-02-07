import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempHome } from "./test-helpers.js";

describe("config version warning", () => {
  it("skips future version warning when running dev build (0.0.0)", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });

      // Write a config that was "touched" by a newer version
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            meta: {
              lastTouchedVersion: "2025.2.1",
              lastTouchedAt: new Date().toISOString(),
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      // Mock VERSION to be 0.0.0 (dev build)
      vi.doMock("../version.js", () => ({ VERSION: "0.0.0" }));

      const warnSpy = vi.fn();
      vi.resetModules();
      const { createConfigIO } = await import("./io.js");

      const io = createConfigIO({
        homedir: () => home,
        logger: {
          error: console.error,
          warn: warnSpy,
        },
      });

      io.loadConfig();

      // Should NOT warn about future version when running dev build
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  it("warns about future version when running stable build", async () => {
    await withTempHome(async (home) => {
      const configDir = path.join(home, ".openclaw");
      await fs.mkdir(configDir, { recursive: true });

      // Write a config that was "touched" by a newer version
      await fs.writeFile(
        path.join(configDir, "openclaw.json"),
        JSON.stringify(
          {
            meta: {
              lastTouchedVersion: "2025.2.1",
              lastTouchedAt: new Date().toISOString(),
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      // Mock VERSION to be an older stable version
      vi.doMock("../version.js", () => ({ VERSION: "2025.1.15" }));

      const warnSpy = vi.fn();
      vi.resetModules();
      const { createConfigIO } = await import("./io.js");

      const io = createConfigIO({
        homedir: () => home,
        logger: {
          error: console.error,
          warn: warnSpy,
        },
      });

      io.loadConfig();

      // SHOULD warn about future version when running stable build
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config was last written by a newer OpenClaw"),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("2025.2.1"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("2025.1.15"));
    });
  });
});
