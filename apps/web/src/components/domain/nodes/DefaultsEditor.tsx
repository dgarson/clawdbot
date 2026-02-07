/**
 * DefaultsEditor - inline panel for editing the default exec approvals
 * policy values that all agents inherit from.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PolicySelectRow,
  PolicyToggleRow,
} from "./ExecApprovalsPolicyRow";
import type { ExecApprovalsDefaults } from "@/lib/api/nodes";
import { Pencil, Save, X } from "lucide-react";

interface DefaultsEditorProps {
  defaults: ExecApprovalsDefaults;
  onSave: (defaults: ExecApprovalsDefaults) => void;
}

const SECURITY_OPTIONS = [
  { value: "deny", label: "Deny" },
  { value: "allowlist", label: "Allowlist" },
  { value: "full", label: "Full" },
];

const ASK_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "on-miss", label: "On miss" },
  { value: "always", label: "Always" },
];

const ASK_FALLBACK_OPTIONS = [
  { value: "deny", label: "Deny" },
  { value: "allowlist", label: "Allowlist" },
  { value: "full", label: "Full" },
];

export function DefaultsEditor({ defaults, onSave }: DefaultsEditorProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ExecApprovalsDefaults>({});

  React.useEffect(() => {
    setDraft({ ...defaults });
  }, [defaults]);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...defaults });
    setEditing(false);
  };

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Default Policy
        </span>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" className="h-7" onClick={handleCancel}>
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button size="sm" className="h-7" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 divide-y divide-border/50">
        <PolicySelectRow
          label="Security"
          description="Default security mode"
          value={draft.security}
          defaultValue="deny"
          options={SECURITY_OPTIONS}
          onChange={(v) => setDraft({ ...draft, security: v ?? "deny" })}
          editing={editing}
        />
        <PolicySelectRow
          label="Ask"
          description="Default prompt policy"
          value={draft.ask}
          defaultValue="on-miss"
          options={ASK_OPTIONS}
          onChange={(v) => setDraft({ ...draft, ask: v ?? "on-miss" })}
          editing={editing}
        />
        <PolicySelectRow
          label="Ask fallback"
          description="When UI prompt unavailable"
          value={draft.askFallback}
          defaultValue="deny"
          options={ASK_FALLBACK_OPTIONS}
          onChange={(v) => setDraft({ ...draft, askFallback: v ?? "deny" })}
          editing={editing}
        />
        <PolicyToggleRow
          label="Auto-allow skill CLIs"
          description="Allow skill-listed executables"
          value={draft.autoAllowSkills}
          defaultValue={false}
          onChange={(v) => setDraft({ ...draft, autoAllowSkills: v ?? false })}
          editing={editing}
        />
      </div>
    </div>
  );
}
