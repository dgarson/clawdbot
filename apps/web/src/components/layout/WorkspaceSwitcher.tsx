import { motion, AnimatePresence } from "framer-motion";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface WorkspaceSwitcherProps {
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when creating a new workspace */
  onCreateWorkspace?: () => void;
}

export function WorkspaceSwitcher({
  collapsed = false,
  onCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useWorkspaceStore();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Don't render if no workspaces (or just show create button)
  if (workspaces.length === 0 && !onCreateWorkspace) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 text-sm transition-colors",
            "hover:bg-secondary hover:border-border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-2"
          )}
        >
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary",
            )}
          >
            {activeWorkspace?.name.charAt(0).toUpperCase() ?? "W"}
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 items-center justify-between overflow-hidden"
              >
                <span className="truncate font-medium">
                  {activeWorkspace?.name ?? "Select Workspace"}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => switchWorkspace(workspace.id)}
            className="flex items-center gap-2"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate">{workspace.name}</span>
            {workspace.id === activeWorkspaceId && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        {onCreateWorkspace && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateWorkspace} className="gap-2">
              <Plus className="size-4" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
