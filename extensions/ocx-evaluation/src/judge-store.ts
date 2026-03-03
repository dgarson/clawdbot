/**
 * Judge profile storage and matching.
 *
 * Profiles are persisted in a single JSON file:
 *   {stateDir}/evaluation/{judgeProfilesFile}
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { JudgeProfile } from "./types.js";

export class JudgeStore {
  private readonly filePath: string;
  private profiles: JudgeProfile[] = [];
  private loaded = false;

  constructor(stateDir: string, filename: string) {
    this.filePath = join(stateDir, "evaluation", filename);
  }

  /** Load profiles from disk. Called lazily on first access. */
  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    if (!existsSync(this.filePath)) {
      this.profiles = [];
      return;
    }

    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.profiles = parsed as JudgeProfile[];
      }
    } catch {
      // Corrupted file -- start fresh
      this.profiles = [];
    }
  }

  /** Persist profiles to disk. */
  private save(): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.profiles, null, 2), "utf-8");
  }

  /** List all judge profiles. */
  list(): JudgeProfile[] {
    this.ensureLoaded();
    return [...this.profiles];
  }

  /** Get a profile by id. */
  get(id: string): JudgeProfile | undefined {
    this.ensureLoaded();
    return this.profiles.find((p) => p.id === id);
  }

  /** Create or update a judge profile. */
  set(profile: JudgeProfile): void {
    this.ensureLoaded();
    const idx = this.profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      this.profiles[idx] = profile;
    } else {
      this.profiles.push(profile);
    }
    this.save();
  }

  /** Delete a profile by id. Returns true if found and deleted. */
  delete(id: string): boolean {
    this.ensureLoaded();
    const idx = this.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.profiles.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Find the best matching judge profile for a classification label.
   * Returns undefined if no profile matches.
   */
  matchByLabel(label: string): JudgeProfile | undefined {
    this.ensureLoaded();

    // Exact match on matchLabels first
    const exact = this.profiles.find((p) => p.matchLabels.includes(label));
    if (exact) return exact;

    // Fallback: a profile with wildcard "*" label
    return this.profiles.find((p) => p.matchLabels.includes("*"));
  }
}
