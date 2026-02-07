"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Monitor, CheckCircle2, Apple, ExternalLink, AlertCircle, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { iMessageIcon as IMessageIcon } from "./icons";
import type { iMessageConfig } from "./types";

type ConnectionStatus = "connected" | "not_configured" | "unavailable";

interface IMessageConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected?: boolean;
  /** Whether the gateway is running on macOS */
  isMacOS?: boolean;
  /** Status message from the gateway */
  statusMessage?: string;
  config?: iMessageConfig;
  onSave?: (config: iMessageConfig) => Promise<void>;
}

export function IMessageConfigSheet({
  open,
  onOpenChange,
  isConnected,
  isMacOS = false,
  statusMessage,
  config,
  onSave,
}: IMessageConfigSheetProps) {
  const [cliPath, setCliPath] = React.useState(config?.cliPath ?? "");
  const [dbPath, setDbPath] = React.useState(config?.dbPath ?? "");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCliPath(config?.cliPath ?? "");
      setDbPath(config?.dbPath ?? "");
      setIsSaving(false);
    }
  }, [open, config]);

  const handleSave = async () => {
    if (!onSave) {return;}
    setIsSaving(true);
    try {
      await onSave({
        cliPath: cliPath.trim() || undefined,
        dbPath: dbPath.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };
  // Determine the connection status
  const status: ConnectionStatus = isConnected
    ? "connected"
    : isMacOS
      ? "not_configured"
      : "unavailable";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#34C75920" }}
            >
              <IMessageIcon className="h-5 w-5" style={{ color: "#34C759" }} />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <DialogTitle>iMessage</DialogTitle>
                <DialogDescription>macOS native messaging</DialogDescription>
              </div>
              <Badge variant="secondary" className="ml-2">
                <Monitor className="mr-1 h-3 w-3" />
                Local Only
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* macOS-only badge banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 p-3"
          >
            <Apple className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">macOS Only</span>
          </motion.div>

          {status === "connected" ? (
            /* Connected state */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-medium">iMessage is Active</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your agent can send and receive iMessages through the local Messages app.
                </p>
                {statusMessage && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    {statusMessage}
                  </p>
                )}
              </div>

              <div className="w-full rounded-lg border border-green-500/20 bg-green-500/5 p-3 mt-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div className="text-muted-foreground">
                    <p className="font-medium text-foreground">Status: Connected</p>
                    <p className="mt-0.5">Messages app is accessible and ready to send/receive.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : status === "unavailable" ? (
            /* Not on macOS */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <XCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Not Available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    iMessage is only available when running Clawdbrain on macOS.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning">Gateway Not on macOS</p>
                    <p className="text-muted-foreground mt-1">
                      Your gateway appears to be running on a non-macOS system.
                      iMessage integration requires macOS with the Messages app.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Not configured (on macOS but not set up) */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex gap-3">
                  <Monitor className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Local Mac Setup Required</p>
                    <p className="text-muted-foreground mt-1">
                      iMessage integration requires Clawdbrain to be running on a Mac with
                      Messages app configured. No credentials are needed - just proper permissions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <p className="font-medium">Setup Checklist:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                      1
                    </div>
                    <span className="text-muted-foreground">
                      Sign in to Messages app with your Apple ID
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                      2
                    </div>
                    <span className="text-muted-foreground">
                      Grant Full Disk Access to Clawdbrain in System Settings → Privacy & Security
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                      3
                    </div>
                    <span className="text-muted-foreground">
                      Restart the Clawdbrain gateway
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-2">
                <a
                  href="https://docs.clawdbrain.bot/channels/imessage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Read the full setup guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {isMacOS && (
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
                  <p className="text-sm font-medium">Advanced paths (optional)</p>
                  <div className="space-y-2">
                    <Label htmlFor="imessage-cli">imsg binary path</Label>
                    <Input
                      id="imessage-cli"
                      type="text"
                      placeholder="/usr/local/bin/imsg"
                      value={cliPath}
                      onChange={(event) => setCliPath(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imessage-db">Messages database path</Label>
                    <Input
                      id="imessage-db"
                      type="text"
                      placeholder="~/Library/Messages/chat.db"
                      value={dbPath}
                      onChange={(event) => setDbPath(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onSave && isMacOS && status !== "unavailable" && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
