import type { GatewayBrowserClient } from "../gateway.ts";
import type { SkillStatusReport } from "../types.ts";
import { toast } from "../components/toast.ts";
import { optimistic, snapshot } from "../utils/optimistic.ts";

export type SkillsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  skillsLoading: boolean;
  skillsReport: SkillStatusReport | null;
  skillsError: string | null;
  skillsBusyKey: string | null;
  skillEdits: Record<string, string>;
  skillMessages: SkillMessageMap;
};

export type SkillMessage = {
  kind: "success" | "error";
  message: string;
};

export type SkillMessageMap = Record<string, SkillMessage>;

type LoadSkillsOptions = {
  clearMessages?: boolean;
};

function setSkillMessage(state: SkillsState, key: string, message?: SkillMessage) {
  if (!key.trim()) {
    return;
  }
  const next = { ...state.skillMessages };
  if (message) {
    next[key] = message;
  } else {
    delete next[key];
  }
  state.skillMessages = next;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function loadSkills(state: SkillsState, options?: LoadSkillsOptions) {
  if (options?.clearMessages && Object.keys(state.skillMessages).length > 0) {
    state.skillMessages = {};
  }
  if (!state.client || !state.connected) {
    return;
  }
  if (state.skillsLoading) {
    return;
  }
  state.skillsLoading = true;
  state.skillsError = null;
  try {
    const res = await state.client.request<SkillStatusReport | undefined>("skills.status", {});
    if (res) {
      state.skillsReport = res;
    }
  } catch (err) {
    state.skillsError = getErrorMessage(err);
  } finally {
    state.skillsLoading = false;
  }
}

export function updateSkillEdit(state: SkillsState, skillKey: string, value: string) {
  state.skillEdits = { ...state.skillEdits, [skillKey]: value };
}

export async function updateSkillEnabled(state: SkillsState, skillKey: string, enabled: boolean) {
  if (!state.client || !state.connected) {
    return;
  }

  // Snapshot for rollback
  const prevReport = state.skillsReport ? snapshot(state.skillsReport) : null;
  const prevMessages = snapshot(state.skillMessages);

  await optimistic({
    apply() {
      // Optimistically toggle the skill's disabled state in the report
      if (state.skillsReport?.skills) {
        state.skillsReport = {
          ...state.skillsReport,
          skills: state.skillsReport.skills.map((s) =>
            s.skillKey === skillKey ? { ...s, disabled: !enabled } : s,
          ),
        };
      }
      state.skillsBusyKey = skillKey;
      state.skillsError = null;
      setSkillMessage(state, skillKey);
    },
    rollback() {
      state.skillsReport = prevReport;
      state.skillMessages = prevMessages;
      state.skillsBusyKey = null;
    },
    mutate: () => state.client!.request("skills.update", { skillKey, enabled }),
    async refresh() {
      await loadSkills(state);
      setSkillMessage(state, skillKey, {
        kind: "success",
        message: enabled ? "Skill enabled" : "Skill disabled",
      });
      state.skillsBusyKey = null;
    },
    onError(err) {
      const message = getErrorMessage(err);
      state.skillsError = message;
      setSkillMessage(state, skillKey, {
        kind: "error",
        message,
      });
    },
    toastError: false,
    errorTitle: `${enabled ? "Enable" : "Disable"} skill failed`,
  });

  state.skillsBusyKey = null;
}

export async function saveSkillApiKey(state: SkillsState, skillKey: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const apiKey = state.skillEdits[skillKey] ?? "";
    await state.client.request("skills.update", { skillKey, apiKey });
    await loadSkills(state);
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: "API key saved",
    });
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
  } finally {
    state.skillsBusyKey = null;
  }
}

export async function installSkill(
  state: SkillsState,
  skillKey: string,
  name: string,
  installId: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  state.skillsBusyKey = skillKey;
  state.skillsError = null;
  try {
    const result = await state.client.request<{ message?: string }>("skills.install", {
      name,
      installId,
      timeoutMs: 120000,
    });
    await loadSkills(state);
    const successMsg = result?.message ?? "Installed";
    setSkillMessage(state, skillKey, {
      kind: "success",
      message: successMsg,
    });
    toast.success(`Skill "${name}" installed`);
  } catch (err) {
    const message = getErrorMessage(err);
    state.skillsError = message;
    setSkillMessage(state, skillKey, {
      kind: "error",
      message,
    });
    toast.error(`Failed to install skill "${name}"`);
  } finally {
    state.skillsBusyKey = null;
  }
}
