#!/usr/bin/env node
/**
 * test-smart.mjs — Cross-platform heuristic-enhanced test runner for branch changes.
 *
 * Extends test-affected with additional discovery strategies:
 *   1. Co-located tests: foo.ts → foo.test.ts
 *   2. Directory proximity: changed src/cron/state.ts → all src/cron/**\/*.test.ts
 *   3. Vitest related: Vite module graph transitive dependency analysis
 *
 * This is the "best-effort" test mode — catches ~95% of regressions in a fraction
 * of the time of the full suite. Use `pnpm test` for exhaustive validation.
 *
 * Cross-platform notes:
 *   File discovery uses Node.js fs APIs instead of shell commands (find/grep) to ensure
 *   consistent behavior across Unix, macOS, and Windows environments.
 *
 * Usage:
 *   node scripts/test-smart.mjs                       # Smart test vs main
 *   node scripts/test-smart.mjs --base HEAD~3         # Smart test vs specific ref
 *   node scripts/test-smart.mjs --extra src/foo.ts    # Add extra source files
 *   node scripts/test-smart.mjs --verbose              # Show discovery details
 *   node scripts/test-smart.mjs --discovery-only       # Show what would be tested (dry run)
 *
 * Exit codes:
 *   0 — All tests passed (or no tests to run)
 *   1 — Test failures
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

// ── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let baseRef = "main";
const extraFiles = [];
let verbose = false;
let discoveryOnly = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base" && args[i + 1]) {
    baseRef = args[++i];
  } else if (args[i] === "--extra" && args[i + 1]) {
    extraFiles.push(args[++i]);
  } else if (args[i] === "--verbose" || args[i] === "-v") {
    verbose = true;
  } else if (args[i] === "--discovery-only" || args[i] === "--dry-run") {
    discoveryOnly = true;
    verbose = true; // discovery-only implies verbose
  }
}

// ── Get changed files ───────────────────────────────────────────────────────

function getChangedFiles() {
  try {
    const mergeBase = execSync(`git merge-base ${baseRef} HEAD`, {
      encoding: "utf-8",
    }).trim();
    const diff = execSync(`git diff --name-only ${mergeBase} HEAD`, {
      encoding: "utf-8",
    }).trim();
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

// ── Strategy 1: Co-located test files ───────────────────────────────────────

function findColocatedTests(changedFiles) {
  const tests = new Set();
  for (const f of changedFiles) {
    // Skip if the file is already a test
    if (f.includes(".test.")) continue;

    const ext = path.extname(f);
    const base = f.slice(0, -ext.length);
    const testFile = `${base}.test${ext}`;
    if (fs.existsSync(testFile)) {
      tests.add(testFile);
    }
  }
  return tests;
}

// ── Strategy 2: Directory proximity ─────────────────────────────────────────

/**
 * Recursively find test files in a directory up to maxDepth.
 * Cross-platform implementation using Node.js fs APIs.
 */
function findTestFilesRecursive(dir, maxDepth, currentDepth = 0) {
  const tests = [];

  if (currentDepth > maxDepth) return tests;

  try {
    if (!fs.existsSync(dir)) return tests;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && currentDepth < maxDepth) {
        tests.push(...findTestFilesRecursive(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
          tests.push(fullPath);
        }
      }
    }
  } catch {
    // Directory may not exist (deleted files)
  }

  return tests;
}

function findDirectoryTests(changedFiles) {
  const tests = new Set();
  const dirs = new Set();

  for (const f of changedFiles) {
    const dir = path.dirname(f);
    // Only fan out within src/ and extensions/
    if (dir.startsWith("src/") || dir.startsWith("extensions/")) {
      dirs.add(dir);
    }
  }

  for (const dir of dirs) {
    const foundTests = findTestFilesRecursive(dir, 2);
    for (const t of foundTests) {
      tests.add(t);
    }
  }

  return tests;
}

// ── Strategy 3: Index/barrel file fan-out ───────────────────────────────────

function findIndexDependentTests(changedFiles) {
  const tests = new Set();

  for (const f of changedFiles) {
    const basename = path.basename(f);
    // If an index file changed, look for tests in the parent directory tree
    if (basename === "index.ts" || basename === "index.tsx") {
      const dir = path.dirname(f);
      // Go one level up since index.ts re-exports are often used by sibling modules
      const parentDir = path.dirname(dir);
      if (parentDir.startsWith("src/") || parentDir.startsWith("extensions/")) {
        const foundTests = findTestFilesRecursive(parentDir, 3);
        for (const t of foundTests) {
          tests.add(t);
        }
      }
    }
  }

  return tests;
}

// ── Run vitest with specific test files ─────────────────────────────────────

const WARNING_SUPPRESSION_FLAGS = [
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=DEP0040",
  "--disable-warning=DEP0060",
];

const localWorkers = Math.max(4, Math.min(16, os.cpus().length));

function runVitestRelated(configName, configPath, sourceFiles) {
  return new Promise((resolve) => {
    if (sourceFiles.length === 0) {
      if (verbose) console.log(`  [${configName}] No related files — skipping`);
      resolve(0);
      return;
    }

    console.log(`  [${configName}] Running related tests for ${sourceFiles.length} files`);

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
  console.log("🧠 test:smart — Heuristic + module-graph test discovery\n");

  const changedFiles = [...getChangedFiles(), ...extraFiles];

  if (changedFiles.length === 0) {
    console.log("✅ No changed files found — nothing to test");
    process.exit(0);
  }

  console.log(`📋 ${changedFiles.length} changed files detected\n`);

  // Run all discovery strategies
  const colocated = findColocatedTests(changedFiles);
  const directoryTests = findDirectoryTests(changedFiles);
  const indexTests = findIndexDependentTests(changedFiles);

  // Merge all discovered test files
  const allDiscoveredTests = new Set([...colocated, ...directoryTests, ...indexTests]);

  // Source files for vitest related (non-test files)
  const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);
  const sourceFiles = changedFiles.filter((f) => {
    const ext = path.extname(f);
    return sourceExtensions.has(ext);
  });

  if (verbose) {
    console.log("📦 Discovery Results:");
    console.log(`  Co-located tests:     ${colocated.size} files`);
    console.log(`  Directory proximity:   ${directoryTests.size} files`);
    console.log(`  Index fan-out:         ${indexTests.size} files`);
    console.log(`  Total unique tests:    ${allDiscoveredTests.size} files`);
    console.log(`  Source files for related: ${sourceFiles.length} files`);

    if (allDiscoveredTests.size > 0) {
      console.log("\n  Discovered test files:");
      for (const t of [...allDiscoveredTests].sort()) {
        const sources = [];
        if (colocated.has(t)) sources.push("colocated");
        if (directoryTests.has(t)) sources.push("directory");
        if (indexTests.has(t)) sources.push("index");
        console.log(`    ${t} (${sources.join(", ")})`);
      }
    }
    console.log();
  }

  if (discoveryOnly) {
    console.log("🏁 Discovery-only mode — exiting without running tests");
    process.exit(0);
  }

  // Combine: pass both source files (for vitest related module graph) and
  // explicitly discovered test files (which vitest related will include if they exist)
  const allFilesToAnalyze = new Set([...sourceFiles, ...allDiscoveredTests]);
  const filesToPass = [...allFilesToAnalyze];

  if (filesToPass.length === 0) {
    console.log("✅ No testable files found — nothing to test");
    process.exit(0);
  }

  console.log(`🔬 Analyzing ${filesToPass.length} files across all test configs\n`);

  const configs = [
    { name: "unit", path: "vitest.unit.config.ts" },
    { name: "extensions", path: "vitest.extensions.config.ts" },
    { name: "gateway", path: "vitest.gateway.config.ts" },
  ];

  // Run unit and extensions in parallel, gateway serial
  const parallelConfigs = configs.filter((c) => c.name !== "gateway");
  const serialConfigs = configs.filter((c) => c.name === "gateway");

  let hadFailure = false;

  if (parallelConfigs.length > 0) {
    const results = await Promise.all(
      parallelConfigs.map((c) => runVitestRelated(c.name, c.path, filesToPass)),
    );
    if (results.some((r) => r !== 0)) hadFailure = true;
  }

  for (const c of serialConfigs) {
    const result = await runVitestRelated(c.name, c.path, filesToPass);
    if (result !== 0) hadFailure = true;
  }

  if (hadFailure) {
    console.log("\n❌ Some smart tests failed");
    process.exit(1);
  } else {
    console.log("\n✅ All smart tests passed");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
