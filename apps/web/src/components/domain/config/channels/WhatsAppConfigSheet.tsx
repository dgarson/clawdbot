
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, QrCode, RefreshCw, CheckCircle2, Smartphone, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "./icons";
import type { WhatsAppConfig } from "./types";

type PairingStatus = "idle" | "generating" | "waiting" | "connected" | "error";

interface WhatsAppConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: WhatsAppConfig;
  onStartPairing: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  isConnected?: boolean;
}

export function WhatsAppConfigSheet({
  open,
  onOpenChange,
  config,
  onStartPairing,
  onDisconnect,
  isConnected,
}: WhatsAppConfigSheetProps) {
  const [pairingStatus, setPairingStatus] = React.useState<PairingStatus>("idle");
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  // Reset state when sheet opens
  React.useEffect(() => {
    if (open) {
      setPairingStatus("idle");
    }
  }, [open]);

  // Simulate QR code expiration and refresh prompt (in real implementation, this would be driven by WebSocket events)
  React.useEffect(() => {
    if (pairingStatus === "waiting" && config?.qrCode) {
      // QR codes typically expire after ~60 seconds
      const timeout = setTimeout(() => {
        // In real implementation, the backend would notify expiration
      }, 60000);
      return () => clearTimeout(timeout);
    }
  }, [pairingStatus, config?.qrCode]);

  const handleStartPairing = async () => {
    setPairingStatus("generating");
    try {
      await onStartPairing();
      setPairingStatus("waiting");
    } catch {
      setPairingStatus("error");
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) {return;}
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      onOpenChange(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#25D36620" }}
            >
              <WhatsAppIcon className="h-5 w-5" style={{ color: "#25D366" }} />
            </div>
            <div>
              <DialogTitle>WhatsApp</DialogTitle>
              <DialogDescription>Connect via QR code</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <AnimatePresence mode="wait">
            {isConnected && config?.phoneNumber ? (
              /* Connected state */
              <motion.div
                key="connected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Connected to</p>
                    <p className="text-xl font-semibold">{config.phoneNumber}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Your WhatsApp is linked and ready to receive messages.
                  </p>
                </div>
              </motion.div>
            ) : pairingStatus === "generating" ? (
              /* Generating QR code */
              <motion.div
                key="generating"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-4 py-8"
              >
                <div className="relative flex h-48 w-48 items-center justify-center rounded-xl border border-border bg-white">
                  <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Generating QR code...
                </p>
              </motion.div>
            ) : pairingStatus === "waiting" || config?.qrCode ? (
              /* QR code display with scan instructions */
              <motion.div
                key="qrcode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {config?.qrCode ? (
                      <div className="rounded-lg border border-border bg-white p-4">
                        <img
                          src={config.qrCode}
                          alt="WhatsApp QR Code"
                          className="h-48 w-48"
                        />
                      </div>
                    ) : (
                      /* Placeholder QR code pattern */
                      <div className="relative flex h-56 w-56 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                        <div className="absolute inset-4 grid grid-cols-8 gap-0.5 opacity-20">
                          {Array.from({ length: 64 }).map((_, i) => (
                            <div
                              key={i}
                              className={`aspect-square ${Math.random() > 0.5 ? "bg-foreground" : "bg-transparent"}`}
                            />
                          ))}
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <QrCode className="h-12 w-12 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">QR Code</span>
                        </div>
                      </div>
                    )}
                    {/* Scanning indicator overlay */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="absolute left-0 right-0 h-0.5 bg-green-500/50"
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ScanLine className="h-4 w-4" />
                    Scan this QR code with WhatsApp
                  </div>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1">
                    <li>Open WhatsApp on your phone</li>
                    <li>
                      Tap <span className="font-medium text-foreground">Menu</span> or{" "}
                      <span className="font-medium text-foreground">Settings</span>
                    </li>
                    <li>
                      Select <span className="font-medium text-foreground">Linked Devices</span>
                    </li>
                    <li>
                      Tap <span className="font-medium text-foreground">Link a Device</span>
                    </li>
                    <li>Point your phone at this screen</li>
                  </ol>
                </div>

                {/* Waiting status */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for scan...
                </div>

                <Button
                  variant="outline"
                  onClick={handleStartPairing}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh QR Code
                </Button>
              </motion.div>
            ) : (
              /* Initial state - prompt to start pairing */
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-4 py-8"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted">
                  <Smartphone className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium">Link Your WhatsApp</p>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    Scan a QR code with your phone to connect WhatsApp to Clawdbrain
                  </p>
                </div>
                <Button
                  onClick={handleStartPairing}
                  className="mt-2"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Generate QR Code
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          {isConnected && onDisconnect && (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
