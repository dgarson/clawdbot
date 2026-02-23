import { createLocalSandbox, type LocalSandboxRuntime } from "@openclaw/sandbox";
import { createClient } from "@openclaw/sdk";

export interface RunResult {
  exitCode: number;
  output: string;
}

interface ParsedArgs {
  _?: string[];
  [key: string]: string | boolean | string[] | undefined;
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
  "  openclaw-cli sandbox start --root ... [--timeout-ms ...]\n" +
  "  openclaw-cli sandbox status --root ...\n" +
  "  openclaw-cli sandbox stop --root ... [--force]\n" +
  "  openclaw-cli sandbox exec --root ... --input ...\n" +
  "  openclaw-cli sandbox verify --root ... [--timeout-ms ...]\n";

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
  const root = readStringArg(parsed.root)?.trim();
  if (root === undefined || root.length === 0) {
    return process.cwd();
  }

  return root;
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
      throw new Error(`Invalid --input JSON: ${error.message}`);
    }

    throw new Error("Invalid --input JSON");
  }
};

const runSandboxVerification = async (sandbox: LocalSandboxRuntime): Promise<RunResult> => {
  try {
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
  } finally {
    await sandbox.stop({ force: true });
  }
};

export const run = async (argv: string[] = []): Promise<RunResult> => {
  const parsed = parseArgs(argv);
  const args = parsed._ ?? [];
  const top = args[0];

  try {
    if (!top) {
      const output = help();
      return { exitCode: 1, output };
    }

    if (top === "sdk") {
      const command = args[1] ?? "doctor";
      if (command === "doctor") {
        const baseUrl = readStringArg(parsed["base-url"]) ?? "http://127.0.0.1:3939";
        const timeoutMsArg = readStringArg(parsed["timeout-ms"]);
        const timeoutMs = timeoutMsArg === undefined ? undefined : parseTimeoutMs(timeoutMsArg);

        const client = createClient({
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

    if (top === "sandbox") {
      const command = args[1] ?? "status";
      const root = readRootArg(parsed);
      const timeoutMsArg = readStringArg(parsed["timeout-ms"]);
      const timeoutMs = timeoutMsArg === undefined ? undefined : parseTimeoutMs(timeoutMsArg);
      const sandbox = createLocalSandbox({
        rootDir: root,
        timeoutMs,
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
        const input = parseInputPayload(rawInput);
        await sandbox.start();
        const result = await sandbox.exec({ input });
        return {
          exitCode: 0,
          output: `sandbox exec: ${JSON.stringify(result.output)}`,
        };
      }

      if (command === "verify") {
        return runSandboxVerification(sandbox);
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
