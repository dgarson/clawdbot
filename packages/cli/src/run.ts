import { createLocalSandbox, type LocalSandboxRuntime } from "@openclaw/sandbox";
import { createClient } from "@openclaw/sdk";
import {
  resolveTemplateKind,
  scaffoldTemplate,
  resolveTemplateName,
  type TemplateKind,
} from "./scaffold.js";

export interface RunResult {
  exitCode: number;
  output: string;
}

interface ParsedArgs {
  _?: string[];
  [key: string]: string | boolean | string[] | undefined;
}

interface RunDependencies {
  createClient: typeof createClient;
  createLocalSandbox: typeof createLocalSandbox;
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const out: ParsedArgs = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) {
      (out._ as string[]).push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
      continue;
    }

    out[key] = true;
  }

  return out;
};

const help = (): string =>
  "Usage:\n" +
  "  openclaw-cli sdk doctor [--base-url ...] [--timeout-ms ...]\n" +
  "  openclaw-cli sandbox start --root ... [--timeout-ms ...] [--watch]\n" +
  "  openclaw-cli sandbox status --root ...\n" +
  "  openclaw-cli sandbox stop --root ... [--force]\n" +
  "  openclaw-cli sandbox exec --root ... --input ... [--keep-alive]\n" +
  "  openclaw-cli sandbox verify --root ... [--timeout-ms ...] [--keep-alive]\n" +
  "  openclaw-cli new plugin|agent [name] --root ... [--description ...]\n";

const readStringArg = (value: string | boolean | string[] | undefined): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const parseTimeoutMs = (value: string | undefined, flag = "--timeout-ms"): number => {
  if (value === undefined) {
    throw new Error(`Missing ${flag} value`);
  }

  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid ${flag} value ${value}`);
  }

  return Math.floor(timeoutMs);
};

const readRootArg = (parsed: ParsedArgs): string => {
  const root = readStringArg(parsed.root);
  if (root === undefined) {
    return process.cwd();
  }

  const trimmedRoot = root.trim();
  if (trimmedRoot.length === 0) {
    throw new Error("--root value cannot be empty");
  }

  return trimmedRoot;
};

const readInputArg = (raw: string | boolean | string[]): string => {
  const input = Array.isArray(raw) ? raw[0] : raw;
  if (!input || typeof input !== "string" || input.length === 0) {
    throw new Error("--input is required for sandbox exec");
  }

  return input;
};

const parseInputPayload = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid --input JSON: ${error.message}`, { cause: error });
    }

    throw new Error("Invalid --input JSON", { cause: error });
  }
};

const parseWatchMs = (parsed: ParsedArgs): number | undefined => {
  const value = readStringArg(parsed["watch-debounce-ms"]);
  if (value === undefined) {
    return undefined;
  }

  return parseTimeoutMs(value, "--watch-debounce-ms");
};

const withSandboxLifecycle = async <T>(
  sandbox: LocalSandboxRuntime,
  command: () => Promise<T>,
  options: {
    keepRuntime?: boolean;
  } = {},
): Promise<T> => {
  let result: T | undefined;
  const keepRuntime = options.keepRuntime === true;

  try {
    result = await command();
  } catch (error) {
    if (!keepRuntime) {
      await sandbox.stop({ force: true }).catch(() => {
        return;
      });
    }

    throw error;
  }

  if (keepRuntime) {
    return result;
  }

  try {
    await sandbox.stop({ force: true });
  } catch (error) {
    throw new Error(
      `sandbox cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        cause: error,
      },
    );
  }

  return result;
};

const runSandboxVerification = async (sandbox: LocalSandboxRuntime): Promise<RunResult> => {
  await sandbox.start();
  const startedStatus = await sandbox.status();
  if (startedStatus.state !== "ready") {
    return {
      exitCode: 1,
      output: `sandbox verify failed: expected ready state, received ${startedStatus.state}`,
    };
  }

  await sandbox.exec({ input: { value: "local-sandbox-verification" } });

  return {
    exitCode: 0,
    output: "sandbox verify passed",
  };
};

const runSandboxExecution = async (
  sandbox: LocalSandboxRuntime,
  rawInput: string,
): Promise<RunResult> => {
  const input = parseInputPayload(rawInput);

  await sandbox.start();
  const result = await sandbox.exec<{ value?: unknown }, { value?: unknown }>({
    input,
  });

  return {
    exitCode: 0,
    output: `sandbox exec: ${JSON.stringify(result.output)}`,
  };
};

const formatCreatedFiles = (result: { targetDir: string; files: string[] }): string => {
  const created = result.files.map((path) => `  - ${path}`).join("\n");
  return `created ${result.targetDir} with files:\n${created}`;
};

export const run = async (
  argv: string[] = [],
  dependencies: RunDependencies = {
    createClient,
    createLocalSandbox,
  },
): Promise<RunResult> => {
  const parsed = parseArgs(argv);
  const args = parsed._ ?? [];
  const top = args[0];

  try {
    if (!top || parsed.help === true) {
      const output = help();
      return { exitCode: 1, output };
    }

    if (top === "sdk") {
      const command = args[1] ?? "doctor";
      if (command === "doctor") {
        const baseUrl = readStringArg(parsed["base-url"]) ?? "http://127.0.0.1:3939";
        const timeoutMsArg = readStringArg(parsed["timeout-ms"]);
        const timeoutMs = timeoutMsArg === undefined ? undefined : parseTimeoutMs(timeoutMsArg);

        const client = dependencies.createClient({
          baseUrl,
          timeoutMs,
        });

        const health = await client.health();
        if (!health.ok) {
          return {
            exitCode: 1,
            output: `sdk doctor failed: ${health.error.code} ${health.error.message}`,
          };
        }

        return {
          exitCode: 0,
          output: `sdk doctor: ${health.data.status} ${health.data.version ?? "unknown"}`,
        };
      }

      return { exitCode: 2, output: `unknown sdk command: ${command}` };
    }

    if (top === "new") {
      const kind = resolveTemplateKind(args[1]);
      const template: TemplateKind = kind;
      const rawName = args[2];
      const name = resolveTemplateName([rawName ?? ""], readStringArg(parsed.name));
      const baseDir = readRootArg(parsed);
      const description = readStringArg(parsed.description) ?? `Generated ${template} template`;

      const result = await scaffoldTemplate({
        template,
        baseDir,
        name,
        description,
        force: parsed.force === true,
      });

      return {
        exitCode: 0,
        output: formatCreatedFiles(result),
      };
    }

    if (top === "sandbox") {
      const command = args[1] ?? "status";
      const root = readRootArg(parsed);
      const timeoutMsArg = readStringArg(parsed["timeout-ms"]);
      const timeoutMs = timeoutMsArg === undefined ? undefined : parseTimeoutMs(timeoutMsArg);
      const watchDebounceMs = parseWatchMs(parsed);

      const sandbox = dependencies.createLocalSandbox({
        rootDir: root,
        timeoutMs,
        watch: command === "start" && parsed.watch === true,
        watchDebounceMs,
        watchPaths: ["."],
      });

      if (command === "start") {
        await sandbox.start();
        const status = await sandbox.status();
        return {
          exitCode: 0,
          output: `sandbox state: ${status.state}`,
        };
      }

      if (command === "status") {
        const status = await sandbox.status();
        return {
          exitCode: 0,
          output: `sandbox state: ${status.state}`,
        };
      }

      if (command === "stop") {
        await sandbox.stop({ force: parsed.force === true });
        return { exitCode: 0, output: "sandbox stopped" };
      }

      if (command === "exec") {
        const rawInput = readInputArg(readStringArg(parsed.input) ?? false);
        return await withSandboxLifecycle(sandbox, () => runSandboxExecution(sandbox, rawInput), {
          keepRuntime: parsed["keep-alive"] === true,
        });
      }

      if (command === "verify") {
        return await withSandboxLifecycle(sandbox, () => runSandboxVerification(sandbox), {
          keepRuntime: parsed["keep-alive"] === true,
        });
      }

      return { exitCode: 2, output: `unknown sandbox command: ${command}` };
    }

    return { exitCode: 2, output: `unknown command: ${top}` };
  } catch (error) {
    return {
      exitCode: 1,
      output: error instanceof Error ? error.message : "command failed",
    };
  }
};
