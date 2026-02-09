/**
 * Chrome Cookie Import — reads cookies from the user's real Chrome/Chromium/Brave
 * browser profile and converts them into Playwright-compatible cookie objects.
 *
 * This allows reusing existing web logins (ChatGPT, GitHub, etc.) inside the
 * OpenClaw-managed browser without re-authenticating.
 *
 * Supported platforms:
 *   - Linux: v10/v11 decryption (PBKDF2 with "peanuts" password)
 *   - macOS: v10 decryption via Keychain ("Chrome Safe Storage" key)
 *   - Windows: not yet supported (DPAPI encryption)
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChromeProfileSource = {
  /** Full path to the Chrome user data directory (e.g. ~/.config/google-chrome). Auto-detected if omitted. */
  chromeUserDataDir?: string;
  /** Profile sub-directory within the user data dir (default: "Default"). */
  profileSubdir?: string;
  /** Only import cookies whose domain matches one of these (e.g. ["chatgpt.com", "openai.com"]). Imports all if omitted. */
  domains?: string[];
};

export type ImportedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

export type ChromeProfileInfo = {
  /** Directory name (e.g. "Default", "Profile 1") */
  name: string;
  /** Display name from Preferences (if available) */
  displayName?: string;
  /** Whether a Cookies database exists for this profile */
  hasCookies: boolean;
};

// ---------------------------------------------------------------------------
// Chrome profile discovery
// ---------------------------------------------------------------------------

const CHROME_USER_DATA_DIRS: Record<string, string[]> = {
  linux: [".config/google-chrome", ".config/chromium", ".config/BraveSoftware/Brave-Browser"],
  darwin: [
    "Library/Application Support/Google/Chrome",
    "Library/Application Support/Chromium",
    "Library/Application Support/BraveSoftware/Brave-Browser",
  ],
  win32: [
    "AppData/Local/Google/Chrome/User Data",
    "AppData/Local/Chromium/User Data",
    "AppData/Local/BraveSoftware/Brave-Browser/User Data",
  ],
};

export function findChromeUserDataDirs(): string[] {
  const home = os.homedir();
  const platform = process.platform as string;
  const candidates = CHROME_USER_DATA_DIRS[platform] ?? CHROME_USER_DATA_DIRS.linux;
  return candidates
    .map((rel) => path.join(home, rel))
    .filter((dir) => {
      try {
        return fs.existsSync(dir);
      } catch {
        return false;
      }
    });
}

function findCookieDb(chromeUserDataDir: string, profileSubdir: string): string | null {
  const candidates = [
    path.join(chromeUserDataDir, profileSubdir, "Network", "Cookies"),
    path.join(chromeUserDataDir, profileSubdir, "Cookies"),
  ];
  return (
    candidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) ?? null
  );
}

/**
 * List available Chrome profiles in a given user data directory.
 */
export function listChromeProfiles(chromeUserDataDir: string): ChromeProfileInfo[] {
  const profiles: ChromeProfileInfo[] = [];
  const entries = fs.readdirSync(chromeUserDataDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    // Chrome profile directories are "Default" or "Profile N"
    if (entry.name !== "Default" && !entry.name.startsWith("Profile ")) {
      continue;
    }
    const hasCookies = findCookieDb(chromeUserDataDir, entry.name) !== null;

    // Try to read display name from Preferences
    let displayName: string | undefined;
    try {
      const prefsPath = path.join(chromeUserDataDir, entry.name, "Preferences");
      if (fs.existsSync(prefsPath)) {
        const prefs = JSON.parse(fs.readFileSync(prefsPath, "utf8")) as {
          profile?: { name?: string };
        };
        displayName = prefs.profile?.name || undefined;
      }
    } catch {
      // best-effort
    }

    profiles.push({ name: entry.name, displayName, hasCookies });
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// Cookie decryption
// ---------------------------------------------------------------------------

/**
 * Chrome epoch (microseconds since 1601-01-01) → Unix epoch (seconds).
 * Returns -1 for session cookies (expires_utc = 0).
 */
function chromeTimeToUnix(chromeTime: number): number {
  if (chromeTime === 0) {
    return -1;
  }
  return Math.floor(chromeTime / 1000000) - 11644473600;
}

function mapSameSite(value: number): "Strict" | "Lax" | "None" {
  switch (value) {
    case 2:
      return "Strict";
    case 1:
      return "Lax";
    default:
      return "None";
  }
}

function deriveLinuxKey(): Buffer {
  return crypto.pbkdf2Sync("peanuts", "saltysalt", 1, 16, "sha1");
}

function deriveMacKey(): Buffer | null {
  try {
    const password = execFileSync(
      "security",
      ["find-generic-password", "-w", "-s", "Chrome Safe Storage"],
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    return crypto.pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  } catch {
    return null;
  }
}

function decryptCookieValue(encrypted: Buffer, key: Buffer): string {
  if (encrypted.length === 0) {
    return "";
  }

  const prefix = encrypted.subarray(0, 3).toString("utf8");
  if (prefix !== "v10" && prefix !== "v11") {
    // Not encrypted — return as-is
    return encrypted.toString("utf8");
  }

  const iv = Buffer.alloc(16, 0x20); // 16 space characters
  const ciphertext = encrypted.subarray(3);
  if (ciphertext.length === 0) {
    return "";
  }

  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

function domainMatches(host: string, filter: string[]): boolean {
  const h = host.toLowerCase();
  return filter.some((f) => h === f || h === `.${f}` || h.endsWith(`.${f}`));
}

/**
 * Read cookies from the user's Chrome/Chromium/Brave browser profile.
 * Returns Playwright-compatible cookie objects ready for `context.addCookies()`.
 */
export function importChromeProfileCookies(source: ChromeProfileSource = {}): ImportedCookie[] {
  // Resolve Chrome user data directory
  const chromeDir = source.chromeUserDataDir ?? findChromeUserDataDirs()[0];
  if (!chromeDir) {
    throw new Error(
      "No Chrome/Chromium/Brave user data directory found. " +
        "Provide chromeUserDataDir explicitly or install Chrome.",
    );
  }

  const profileSubdir = source.profileSubdir ?? "Default";
  const cookieDbPath = findCookieDb(chromeDir, profileSubdir);
  if (!cookieDbPath) {
    throw new Error(
      `No Cookies database found in ${path.join(chromeDir, profileSubdir)}. ` +
        "Has this Chrome profile been used at least once?",
    );
  }

  // Copy the DB to a temp location to avoid lock conflicts with running Chrome
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cookies-"));
  const tmpDb = path.join(tmpDir, "Cookies");

  try {
    fs.copyFileSync(cookieDbPath, tmpDb);
    // Copy WAL/SHM for transaction consistency
    for (const ext of ["-wal", "-shm"]) {
      const src = cookieDbPath + ext;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, tmpDb + ext);
      }
    }

    // Open DB via node:sqlite
    let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("node:sqlite") as typeof import("node:sqlite");
      DatabaseSync = mod.DatabaseSync;
    } catch {
      throw new Error(
        "node:sqlite is not available in this Node.js build. " +
          "Upgrade to Node.js 22.5+ or install sqlite3 CLI as a fallback.",
      );
    }

    const db = new DatabaseSync(tmpDb, { readOnly: true });
    try {
      const rows = db
        .prepare(
          `SELECT host_key, name, value, path, expires_utc,
                is_secure, is_httponly, encrypted_value, samesite
         FROM cookies`,
        )
        .all() as Array<{
        host_key: string;
        name: string;
        value: string;
        path: string;
        expires_utc: number;
        is_secure: number;
        is_httponly: number;
        encrypted_value: Buffer;
        samesite: number;
      }>;

      // Derive decryption key (platform-specific)
      const platform = process.platform;
      let key: Buffer | null = null;
      if (platform === "linux") {
        key = deriveLinuxKey();
      } else if (platform === "darwin") {
        key = deriveMacKey();
      }
      // Windows DPAPI is not supported — encrypted values will be skipped

      const domainFilter = source.domains?.map((d) => d.toLowerCase()) ?? null;
      const now = Math.floor(Date.now() / 1000);
      const cookies: ImportedCookie[] = [];

      for (const row of rows) {
        const domain = row.host_key;

        // Apply domain filter
        if (domainFilter && !domainMatches(domain, domainFilter)) {
          continue;
        }

        // Resolve value: prefer plaintext, fall back to decrypted
        let value = row.value;
        if (!value && row.encrypted_value?.length && key) {
          const buf =
            row.encrypted_value instanceof Buffer
              ? row.encrypted_value
              : Buffer.from(row.encrypted_value as unknown as ArrayBuffer);
          value = decryptCookieValue(buf, key);
        }

        if (!value) {
          continue; // cannot decrypt or empty
        }

        // Skip expired cookies (but keep session cookies with expires = -1)
        const expires = chromeTimeToUnix(Number(row.expires_utc) || 0);
        if (expires > 0 && expires < now) {
          continue;
        }

        cookies.push({
          name: row.name,
          value,
          domain,
          path: row.path || "/",
          expires,
          httpOnly: row.is_httponly === 1,
          secure: row.is_secure === 1,
          sameSite: mapSameSite(row.samesite ?? 0),
        });
      }

      return cookies;
    } finally {
      db.close();
    }
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}
