export class VaultSelfAuthoredFilter {
  private recentWrites = new Map<string, number>();
  private windowMs: number;

  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
  }

  markAsOurs(path: string): void {
    this.recentWrites.set(path, Date.now());
  }

  isOurs(path: string): boolean {
    const ts = this.recentWrites.get(path);
    if (!ts) {
      return false;
    }
    if (Date.now() - ts < this.windowMs) {
      this.recentWrites.delete(path);
      return true;
    }
    this.recentWrites.delete(path);
    return false;
  }
}
