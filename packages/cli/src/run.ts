import { createLocalSandbox } from "@openclaw/sandbox";
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
  "  openclaw-cli sdk doctor [--base-url ...]\n" +
  "  openclaw-cli sandbox start --root ... [--timeout-ms ...]\n" +
  "  openclaw-cli sandbox status --root ...\n" +
  "  openclaw-cli sandbox stop --root ... [--force]\n" +
  "  openclaw-cli sandbox exec --root ... --input ...\n";

const readInputArg = (raw: string | boolean): string => {
  if (raw === undefined || typeof raw !== "string" || raw.length === 0) {
    throw new Error("--input is required for sandbox exec");
  }

  return raw;
};

const write = (value: string): string => value;

export const run = async (argv: string[] = []): Promise<RunResult> => {
  const parsed = parseArgs(argv);
  const args = parsed._ ?? [];
  const top = args[0];

  if (!top) {
    const output = help();
    return { exitCode: 1, output };
  }

  if (top === "sdk") {
    const command = args[1] ?? "doctor";
    if (command === "doctor") {
      const baseUrl =
        typeof parsed["base-url"] === "string" ? parsed["base-url"] : "http://127.0.0.1:3939";
      const client = createClient({
        baseUrl,
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
        output: write(`sdk doctor: ${health.data.status} ${health.data.version}`),
      };
    }

    return { exitCode: 2, output: `unknown sdk command: ${command}` };
  }

  if (top === "sandbox") {
    const command = args[1] ?? "status";
    const root =
      typeof parsed.root === "string" && parsed.root.length > 0 ? parsed.root : process.cwd();
    const rootArg = root;

    const sandbox = createLocalSandbox({
      rootDir: rootArg,
      timeoutMs:
        typeof parsed["timeout-ms"] === "string" ? Number(parsed["timeout-ms"]) : undefined,
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
      const inputOption = Array.isArray(parsed.input) ? parsed.input[0] : (parsed.input ?? false);
      const rawInput = readInputArg(inputOption);
      await sandbox.start();
      const result = await sandbox.exec<{ value: string }, { value: string }>({
        input: JSON.parse(rawInput),
      });
      return {
        exitCode: 0,
        output: `sandbox exec: ${JSON.stringify(result.output)}`,
      };
    }

    return { exitCode: 2, output: `unknown sandbox command: ${command}` };
  }

  return { exitCode: 2, output: `unknown command: ${top}` };
};
