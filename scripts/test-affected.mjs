#!/usr/bin/env node
/**
 * test-affected.mjs — Run only tests related to files changed in the current branch.
 *
 * Uses Vitest's built-in `related` command which leverages Vite's module graph
 * to find tests that transitively import any changed file.
 *
 * Usage:
 *   node scripts/test-affected.mjs                    # Changed vs main
 *   node scripts/test-affected.mjs --base HEAD~3      # Changed vs specific ref
 *   node scripts/test-affected.mjs --extra src/foo.ts  # Add extra source files
 *   node scripts/test-affected.mjs --verbose           # Show diagnostic info
 *
 * Exit codes:
 *   0 — All tests passed (or no tests to run)
 *   1 — Test failures
 */

import { execSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

// ── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let baseRef = "main";
const extraFiles = [];
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base" && args[i + 1]) {
    baseRef = args[++i];
  } else if (args[i] === "--extra" && args[i + 1]) {
    extraFiles.push(args[++i]);
  } else if (args[i] === "--verbose" || args[i] === "-v") {
    verbose = true;
  }
}

// ── Get changed files ───────────────────────────────────────────────────────

function getChangedFiles() {
  try {
    // First try merge-base diff (branch comparison)
    const mergeBase = execSync(`git merge-base ${baseRef} HEAD`, {
      encoding: "utf-8",
    }).trim();
    const diff = execSync(`git diff --name-only ${mergeBase} HEAD`, {
      encoding: "utf-8",
    }).trim();

    // Also include unstaged/staged changes
    const staged = execSync("git diff --name-only --cached", {
      encoding: "utf-8",
    }).trim();
    const unstaged = execSync("git diff --name-only", {
      encoding: "utf-8",
    }).trim();

    const allFiles = new Set();
    for (const chunk of [diff, staged, unstaged]) {
      for (const f of chunk.split("\n").filter(Boolean)) {
        allFiles.add(f);
      }
    }
    return [...allFiles];
  } catch {
    // Fallback: if merge-base fails (e.g., on main itself), use HEAD~1
    try {
      const diff = execSync("git diff --name-only HEAD~1 HEAD", {
        encoding: "utf-8",
      }).trim();
      return diff.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }
}

// ── Filter to source files that exist ───────────────────────────────────────

function filterSourceFiles(files) {
  const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);
  return files.filter((f) => {
    const ext = path.extname(f);
    return sourceExtensions.has(ext);
  });
}

// ── Run vitest related for a config ─────────────────────────────────────────

const WARNING_SUPPRESSION_FLAGS = [
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=DEP0040",
  "--disable-warning=DEP0060",
];

const localWorkers = Math.max(4, Math.min(16, os.cpus().length));

function runVitestRelated(configName, configPath, sourceFiles) {
  return new Promise((resolve) => {
    if (sourceFiles.length === 0) {
      if (verbose) {
        console.log(`  [${configName}] No changed files — skipping`);
      }
      resolve(0);
      return;
    }

    if (verbose) {
      console.log(`  [${configName}] Running related tests for ${sourceFiles.length} files`);
    }

    const vitestArgs = [
      "vitest",
      "related",
      ...sourceFiles,
      "--run",
      "--config",
      configPath,
      "--passWithNoTests",
      "--maxWorkers",
      String(localWorkers),
    ];

    const nodeOptions = process.env.NODE_OPTIONS ?? "";
    const nextNodeOptions = WARNING_SUPPRESSION_FLAGS.reduce(
      (acc, flag) => (acc.includes(flag) ? acc : `${acc} ${flag}`.trim()),
      nodeOptions,
    );

    const child = spawn(pnpm, vitestArgs, {
      stdio: "inherit",
      env: {
        ...process.env,
        VITEST_GROUP: configName,
        NODE_OPTIONS: nextNodeOptions,
      },
      shell: process.platform === "win32",
    });

    child.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 test:affected — Running tests related to changed files\n");

  const changedFiles = getChangedFiles();
  const allSourceFiles = filterSourceFiles([...changedFiles, ...extraFiles]);

  if (allSourceFiles.length === 0) {
    console.log("✅ No changed source files found — nothing to test");
    process.exit(0);
  }

  if (verbose) {
    console.log(`Changed files (${changedFiles.length}):`);
    for (const f of changedFiles) {
      console.log(`  ${String(f)}`);
    }
    if (extraFiles.length) {
      console.log(`Extra files (${extraFiles.length}):`);
      for (const f of extraFiles) {
        console.log(`  ${String(f)}`);
      }
    }
    console.log();
  }

  console.log(`📋 Found ${allSourceFiles.length} changed source files\n`);

  // For vitest related, we pass ALL source files to each config.
  // Vitest will only pick up tests that match the config's include patterns
  // and that actually import the changed files.
  const configs = [
    { name: "unit", path: "vitest.unit.config.ts" },
    { name: "extensions", path: "vitest.extensions.config.ts" },
    { name: "gateway", path: "vitest.gateway.config.ts" },
  ];

  // Run unit and extensions in parallel, gateway serial (matches test-parallel.mjs pattern)
  const parallelConfigs = configs.filter((c) => c.name !== "gateway");
  const serialConfigs = configs.filter((c) => c.name === "gateway");

  let hadFailure = false;

  // Parallel phase
  if (parallelConfigs.length > 0) {
    const results = await Promise.all(
      parallelConfigs.map((c) => runVitestRelated(c.name, c.path, allSourceFiles)),
    );
    if (results.some((r) => r !== 0)) {
      hadFailure = true;
    }
  }

  // Serial phase (gateway)
  for (const c of serialConfigs) {
    const result = await runVitestRelated(c.name, c.path, allSourceFiles);
    if (result !== 0) {
      hadFailure = true;
    }
  }

  if (hadFailure) {
    console.log("\n❌ Some affected tests failed");
    process.exit(1);
  } else {
    console.log("\n✅ All affected tests passed");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
