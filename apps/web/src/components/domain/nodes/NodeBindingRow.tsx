/**
 * NodeBindingRow - a compact row showing which node an agent is bound to
 * for exec, with an inherited indicator when using the default binding.
 */

import { cn } from "@/lib/utils";
import { InheritedBadge } from "./InheritedValue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeEntry } from "@/lib/api/nodes";
import { Server } from "lucide-react";

interface NodeBindingRowProps {
  agentId: string;
  agentName?: string;
  /** The binding for this agent (null = use default). */
  binding: string | null;
  /** The resolved default binding (null = "Any node"). */
  defaultBinding: string | null;
  /** Available nodes that support system.run. */
  execNodes: NodeEntry[];
  onChange: (binding: string | null) => void;
  editing?: boolean;
}

export function NodeBindingRow({
  agentId,
  agentName,
  binding,
  defaultBinding,
  execNodes,
  onChange,
  editing = false,
}: NodeBindingRowProps) {
  const inherited = binding === null;
  const effectiveNodeId = binding ?? defaultBinding;
  const effectiveLabel = effectiveNodeId
    ? (execNodes.find((n) => n.nodeId === effectiveNodeId)?.displayName ?? effectiveNodeId)
    : "Any node";

  const defaultLabel = defaultBinding
    ? (execNodes.find((n) => n.nodeId === defaultBinding)?.displayName ?? defaultBinding)
    : "Any node";

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate">{agentName ?? agentId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-sm",
              inherited ? "text-foreground/70" : "text-foreground font-medium",
            )}
          >
            {effectiveLabel}
          </span>
          {inherited && <InheritedBadge />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{agentName ?? agentId}</span>
      </div>
      <Select
        value={binding ?? "__default__"}
        onValueChange={(v) => onChange(v === "__default__" || v === "__any__" ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">
            Use default ({defaultLabel})
          </SelectItem>
          <SelectItem value="__any__">Any node</SelectItem>
          {execNodes.map((node) => (
            <SelectItem key={node.nodeId} value={node.nodeId}>
              {node.displayName ?? node.nodeId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
