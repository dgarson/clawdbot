"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AgentCoreFilesTab } from "./AgentCoreFilesTab";

export interface CoreFilesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function CoreFilesSheet({ open, onOpenChange, agentId }: CoreFilesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Core Files</SheetTitle>
          <SheetDescription>
            View and edit your agent's core configuration files.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <AgentCoreFilesTab agentId={agentId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CoreFilesSheet;
