import type { VaultAccessLayer } from "./vault-access.js";

export async function safeWrite(params: {
  vault: VaultAccessLayer;
  path: string;
  content: string;
  expectedMtime?: Date;
}): Promise<{ success: boolean; conflict: boolean }> {
  const existing = await params.vault.readFile(params.path);

  if (existing && params.expectedMtime) {
    if (existing.stats.modifiedAt.getTime() !== params.expectedMtime.getTime()) {
      const conflictPath = params.path.replace(/\.md$/, `.${Date.now()}.conflict.md`);
      await params.vault.writeFile(conflictPath, existing.content);
      await params.vault.writeFile(params.path, params.content);
      return { success: true, conflict: true };
    }
  }

  await params.vault.writeFile(params.path, params.content);
  return { success: true, conflict: false };
}
