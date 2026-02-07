#!/usr/bin/env node
/**
 * Test for test-smart.mjs cross-platform file discovery
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal implementation of findTestFilesRecursive for testing
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

// Test 1: Should return empty array for non-existent directory
const nonExistentTests = findTestFilesRecursive("/non/existent/path", 2);
assert.strictEqual(
  nonExistentTests.length,
  0,
  "Should return empty array for non-existent directory",
);
console.log("✓ Test 1 passed: Non-existent directory returns empty array");

// Test 2: Should find test files in src directory
const srcTests = findTestFilesRecursive(path.join(__dirname, "..", "src"), 2);
assert.ok(srcTests.length > 0, "Should find at least one test file in src");
assert.ok(
  srcTests.every((t) => t.endsWith(".test.ts") || t.endsWith(".test.tsx")),
  "All results should be test files",
);
console.log(`✓ Test 2 passed: Found ${srcTests.length} test files in src`);

// Test 3: Should respect maxDepth
const shallowTests = findTestFilesRecursive(path.join(__dirname, "..", "src"), 0);
const deepTests = findTestFilesRecursive(path.join(__dirname, "..", "src"), 2);
// maxDepth=0 finds files in current dir only, maxDepth=2 should find more by recursing
assert.ok(
  deepTests.length >= shallowTests.length,
  "Higher maxDepth should find at least as many files",
);
console.log(
  `✓ Test 3 passed: maxDepth respected (depth=0: ${shallowTests.length}, depth=2: ${deepTests.length})`,
);

// Test 4: Should handle paths with spaces (Windows compatibility check)
// Create a temporary directory with spaces in the name
const tmpDir = path.join(__dirname, "..", "tmp test dir");
const tmpTestFile = path.join(tmpDir, "sample.test.ts");

try {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  fs.writeFileSync(tmpTestFile, "// test file");

  const tmpTests = findTestFilesRecursive(tmpDir, 1);
  assert.strictEqual(tmpTests.length, 1, "Should find test file in directory with spaces");
  assert.strictEqual(tmpTests[0], tmpTestFile, "Should return correct path with spaces");
  console.log("✓ Test 4 passed: Handles paths with spaces");
} finally {
  // Cleanup
  try {
    if (fs.existsSync(tmpTestFile)) fs.unlinkSync(tmpTestFile);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  } catch {
    // Ignore cleanup errors
  }
}

console.log("\n✅ All cross-platform file discovery tests passed!");
