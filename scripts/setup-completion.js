import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function setupCompletion(repoRoot) {
  // Skip in CI or if explicitly disabled
  if (process.env.CI || process.env.OPENCLAW_SKIP_COMPLETION_SETUP) {
    console.log("[setup-completion] Skipped (CI or OPENCLAW_SKIP_COMPLETION_SETUP set)");
    return;
  }

  const binPath = path.join(repoRoot, "openclaw.mjs");
  if (!fs.existsSync(binPath)) {
    console.error("[setup-completion] openclaw.mjs not found");
    process.exit(1);
  }

  // In development, dist might not exist yet
  const distEntry = path.join(repoRoot, "dist", "index.js");
  if (!fs.existsSync(distEntry)) {
    console.error("[setup-completion] dist/index.js not found - run 'pnpm build' first");
    process.exit(1);
  }

  console.log("[setup-completion] Installing shell completions...");
  console.log("[setup-completion] Note: This may take a moment (loading plugins)...");

  try {
    const result = spawnSync(process.execPath, [binPath, "completion", "--install", "--yes"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, OPENCLAW_SKIP_POSTINSTALL: "1" },
    });

    if (result.status !== 0) {
      console.error("[setup-completion] Failed with exit code:", result.status);
      process.exit(result.status ?? 1);
    }
  } catch (err) {
    console.error("[setup-completion] Error:", String(err));
    process.exit(1);
  }
}

const repoRoot = getRepoRoot();
setupCompletion(repoRoot);
