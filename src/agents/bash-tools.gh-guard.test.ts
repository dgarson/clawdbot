import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateGhCommandGuard } from "./bash-tools.gh-guard.js";

const isWin = process.platform === "win32";

async function makeRepoWithBranch(branch: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-gh-guard-"));
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
  await fs.writeFile(path.join(root, ".git", "HEAD"), `ref: refs/heads/${branch}\n`, "utf-8");
  return root;
}

describe("exec gh guard", () => {
  it("blocks git push to protected branches", async () => {
    if (isWin) {
      return;
    }
    const workdir = await makeRepoWithBranch("main");
    await expect(
      validateGhCommandGuard({
        command: "git push origin HEAD",
        workdir,
        config: { enabled: true, protectedBranches: ["main"] },
      }),
    ).rejects.toThrow(/git push to protected branch 'main'/i);
  });

  it("blocks gh pr create without explicit repo when required", async () => {
    if (isWin) {
      return;
    }
    const workdir = await makeRepoWithBranch("feature/test");
    await expect(
      validateGhCommandGuard({
        command: "gh pr create --title test --body test",
        workdir,
        config: { enabled: true, requireExplicitPrRepo: true },
      }),
    ).rejects.toThrow(/requires --repo\/-R/i);
  });

  it("blocks gh pr create when repo is outside allowlist", async () => {
    if (isWin) {
      return;
    }
    const workdir = await makeRepoWithBranch("feature/test");
    await expect(
      validateGhCommandGuard({
        command: "gh pr create --repo openclaw/openclaw --title test --body test",
        workdir,
        config: { enabled: true, allowedPrRepos: ["myfork/openclaw"] },
      }),
    ).rejects.toThrow(/repo must be one of/i);
  });

  it("allows gh pr create when repo is explicitly allowlisted", async () => {
    if (isWin) {
      return;
    }
    const workdir = await makeRepoWithBranch("feature/test");
    await expect(
      validateGhCommandGuard({
        command: "gh pr create --repo myfork/openclaw --title test --body test",
        workdir,
        config: { enabled: true, allowedPrRepos: ["myfork/openclaw"] },
      }),
    ).resolves.toBeUndefined();
  });
});
