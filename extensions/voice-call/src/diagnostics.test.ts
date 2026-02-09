import { describe, expect, it } from "vitest";
import { isVoiceDiagnosticsVerbose } from "./diagnostics.js";

describe("isVoiceDiagnosticsVerbose", () => {
  it("returns false when voice debugging config is missing", () => {
    expect(isVoiceDiagnosticsVerbose(null)).toBe(false);
    expect(isVoiceDiagnosticsVerbose({})).toBe(false);
  });

  it("returns true when verbose/debug/trace is enabled", () => {
    expect(
      isVoiceDiagnosticsVerbose({
        debugging: {
          features: {
            voice: {
              verbose: true,
            },
          },
        },
      }),
    ).toBe(true);

    expect(
      isVoiceDiagnosticsVerbose({
        debugging: {
          features: {
            voice: {
              debug: true,
            },
          },
        },
      }),
    ).toBe(true);

    expect(
      isVoiceDiagnosticsVerbose({
        debugging: {
          features: {
            voice: {
              trace: true,
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("suppresses diagnostics when suppressLogging is true", () => {
    expect(
      isVoiceDiagnosticsVerbose({
        debugging: {
          features: {
            voice: {
              verbose: true,
              suppressLogging: true,
            },
          },
        },
      }),
    ).toBe(false);
  });
});
