import fs from "node:fs";
import path from "node:path";
import { ensurePageState, getPageForTargetId } from "./pw-session.js";

export async function cookiesGetViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<{ cookies: unknown[] }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const cookies = await page.context().cookies();
  return { cookies };
}

export async function cookiesSetViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  cookie: {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "None" | "Strict";
  };
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const cookie = opts.cookie;
  if (!cookie.name || cookie.value === undefined) {
    throw new Error("cookie name and value are required");
  }
  const hasUrl = typeof cookie.url === "string" && cookie.url.trim();
  const hasDomainPath =
    typeof cookie.domain === "string" &&
    cookie.domain.trim() &&
    typeof cookie.path === "string" &&
    cookie.path.trim();
  if (!hasUrl && !hasDomainPath) {
    throw new Error("cookie requires url, or domain+path");
  }
  await page.context().addCookies([cookie]);
}

export async function cookiesClearViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.context().clearCookies();
}

type StorageKind = "local" | "session";

export async function storageGetViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  kind: StorageKind;
  key?: string;
}): Promise<{ values: Record<string, string> }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const kind = opts.kind;
  const key = typeof opts.key === "string" ? opts.key : undefined;
  const values = await page.evaluate(
    ({ kind: kind2, key: key2 }) => {
      const store = kind2 === "session" ? window.sessionStorage : window.localStorage;
      if (key2) {
        const value = store.getItem(key2);
        return value === null ? {} : { [key2]: value };
      }
      const out: Record<string, string> = {};
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i);
        if (!k) {
          continue;
        }
        const v = store.getItem(k);
        if (v !== null) {
          out[k] = v;
        }
      }
      return out;
    },
    { kind, key },
  );
  return { values: values ?? {} };
}

export async function storageSetViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  kind: StorageKind;
  key: string;
  value: string;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const key = String(opts.key ?? "");
  if (!key) {
    throw new Error("key is required");
  }
  await page.evaluate(
    ({ kind, key: k, value }) => {
      const store = kind === "session" ? window.sessionStorage : window.localStorage;
      store.setItem(k, value);
    },
    { kind: opts.kind, key, value: String(opts.value ?? "") },
  );
}

export async function storageClearViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  kind: StorageKind;
}): Promise<void> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  await page.evaluate(
    ({ kind }) => {
      const store = kind === "session" ? window.sessionStorage : window.localStorage;
      store.clear();
    },
    { kind: opts.kind },
  );
}

/**
 * Save the current browser context's storage state (cookies + localStorage)
 * to a JSON file on disk. This file can later be loaded when creating a new
 * context to restore auth sessions.
 */
export async function saveStorageStateViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  filePath: string;
}): Promise<{ path: string }> {
  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const dir = path.dirname(opts.filePath);
  fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: opts.filePath });
  return { path: opts.filePath };
}

/**
 * Restore cookies from a previously saved storage state file into the
 * current browser context. LocalStorage entries are applied by navigating
 * to each origin and injecting values via page.evaluate.
 */
export async function restoreStorageStateViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  filePath: string;
}): Promise<{ cookies: number; origins: number }> {
  if (!fs.existsSync(opts.filePath)) {
    return { cookies: 0, origins: 0 };
  }
  const raw = fs.readFileSync(opts.filePath, "utf8");
  const state = JSON.parse(raw) as {
    cookies?: Array<Record<string, unknown>>;
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
  };

  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const context = page.context();

  // Restore cookies
  const cookies = state.cookies ?? [];
  if (cookies.length > 0) {
    await context.addCookies(cookies as Parameters<typeof context.addCookies>[0]);
  }

  // Restore localStorage per origin
  const origins = state.origins ?? [];
  for (const origin of origins) {
    if (!origin.localStorage?.length) {
      continue;
    }
    // Navigate a temporary page to the origin, set localStorage, then close
    const tempPage = await context.newPage();
    try {
      await tempPage.goto(origin.origin, { timeout: 10_000, waitUntil: "domcontentloaded" });
      await tempPage.evaluate((items: Array<{ name: string; value: string }>) => {
        for (const { name, value } of items) {
          window.localStorage.setItem(name, value);
        }
      }, origin.localStorage);
    } catch {
      // origin might be unreachable — skip localStorage for it
    } finally {
      await tempPage.close().catch(() => {});
    }
  }

  return { cookies: cookies.length, origins: origins.length };
}

/**
 * Import cookies from the user's real Chrome/Chromium/Brave browser profile
 * into the current Playwright browser context. This lets you reuse existing
 * web logins (ChatGPT, GitHub, etc.) without re-authenticating.
 */
export async function importChromeProfileCookiesViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  /** Path to Chrome user data directory (auto-detected if omitted) */
  chromeUserDataDir?: string;
  /** Chrome profile sub-directory (default: "Default") */
  profileSubdir?: string;
  /** Only import cookies for these domains */
  domains?: string[];
}): Promise<{ imported: number }> {
  const { importChromeProfileCookies } = await import("./chrome-cookie-import.js");

  const cookies = importChromeProfileCookies({
    chromeUserDataDir: opts.chromeUserDataDir,
    profileSubdir: opts.profileSubdir,
    domains: opts.domains,
  });

  if (cookies.length === 0) {
    return { imported: 0 };
  }

  const page = await getPageForTargetId(opts);
  ensurePageState(page);
  const context = page.context();

  await context.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })),
  );

  return { imported: cookies.length };
}
