import {
  extractShellWrapperCommand,
  hasEnvManipulationBeforeShellWrapper,
} from "./exec-wrapper-resolution.js";

export type SystemRunCommandValidation =
  | {
      ok: true;
      shellCommand: string | null;
      cmdText: string;
    }
  | {
      ok: false;
      message: string;
      details?: Record<string, unknown>;
    };

export type ResolvedSystemRunCommand =
  | {
      ok: true;
      argv: string[];
      rawCommand: string | null;
      shellCommand: string | null;
      cmdText: string;
    }
  | {
      ok: false;
      message: string;
      details?: Record<string, unknown>;
    };

export function formatExecCommand(argv: string[]): string {
  return argv
    .map((arg) => {
      const trimmed = arg.trim();
      if (!trimmed) {
        return '""';
      }
      const needsQuotes = /\s|"/.test(trimmed);
      if (!needsQuotes) {
        return trimmed;
      }
      return `"${trimmed.replace(/"/g, '\\"')}"`;
    })
    .join(" ");
}

export function extractShellCommandFromArgv(argv: string[]): string | null {
  const token0 = argv[0]?.trim();
  if (!token0) {
    return null;
  }

  const base0 = basenameLower(token0);

  // POSIX-style shells: sh -lc "<cmd>"
  if (
    base0 === "sh" ||
    base0 === "bash" ||
    base0 === "zsh" ||
    base0 === "dash" ||
    base0 === "ksh"
  ) {
    const flag = argv[1]?.trim();
    if (flag !== "-lc" && flag !== "-c") {
      return null;
    }
    const cmd = argv[2];
    return typeof cmd === "string" ? cmd : null;
  }

  // Windows cmd.exe: cmd.exe /d /s /c "<cmd>"
  // All args after /c are the shell command (cmd.exe joins them with spaces).
  if (base0 === "cmd.exe" || base0 === "cmd") {
    const idx = argv.findIndex((item) => String(item).trim().toLowerCase() === "/c");
    if (idx === -1) {
      return null;
    }
    const rest = argv.slice(idx + 1);
    if (rest.length === 0) {
      return null;
    }
    return rest.join(" ");
  }

  return null;
}

export function validateSystemRunCommandConsistency(params: {
  argv: string[];
  rawCommand?: string | null;
}): SystemRunCommandValidation {
  const raw =
    typeof params.rawCommand === "string" && params.rawCommand.trim().length > 0
      ? params.rawCommand.trim()
      : null;
  const shellWrapperResolution = extractShellWrapperCommand(params.argv);
  const shellCommand = shellWrapperResolution.command;
  const envManipulationBeforeShellWrapper =
    shellWrapperResolution.isWrapper && hasEnvManipulationBeforeShellWrapper(params.argv);
  const inferred =
    shellCommand !== null && !envManipulationBeforeShellWrapper
      ? shellCommand.trim()
      : formatExecCommand(params.argv);

  if (raw && raw !== inferred) {
    return {
      ok: false,
      message: "INVALID_REQUEST: rawCommand does not match command",
      details: {
        code: "RAW_COMMAND_MISMATCH",
        rawCommand: raw,
        inferred,
      },
    };
  }

  return {
    ok: true,
    // Only treat this as a shell command when argv is a recognized shell wrapper.
    // For direct argv execution and shell wrappers with env prelude modifiers,
    // rawCommand is purely display/approval text and must match the formatted argv.
    shellCommand:
      shellCommand !== null
        ? envManipulationBeforeShellWrapper
          ? shellCommand
          : (raw ?? shellCommand)
        : null,
    cmdText: raw ?? inferred,
  };
}

export function resolveSystemRunCommand(params: {
  command?: unknown;
  rawCommand?: unknown;
}): ResolvedSystemRunCommand {
  const raw =
    typeof params.rawCommand === "string" && params.rawCommand.trim().length > 0
      ? params.rawCommand.trim()
      : null;
  const command = Array.isArray(params.command) ? params.command : [];
  if (command.length === 0) {
    if (raw) {
      return {
        ok: false,
        message: "rawCommand requires params.command",
        details: { code: "MISSING_COMMAND" },
      };
    }
    return {
      ok: true,
      argv: [],
      rawCommand: null,
      shellCommand: null,
      cmdText: "",
    };
  }

  const argv = command.map((v) => String(v));
  const validation = validateSystemRunCommandConsistency({
    argv,
    rawCommand: raw,
  });
  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
      details: validation.details ?? { code: "RAW_COMMAND_MISMATCH" },
    };
  }

  return {
    ok: true,
    argv,
    rawCommand: raw,
    shellCommand: validation.shellCommand,
    cmdText: validation.cmdText,
  };
}
