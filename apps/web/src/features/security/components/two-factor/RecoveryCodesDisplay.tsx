"use client";

import * as React from "react";
import { Copy, Check, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { RecoveryCodesData } from "../../types";

interface RecoveryCodesDisplayProps {
  /** Recovery codes data */
  codesData: RecoveryCodesData;
  /** Callback when user acknowledges they've saved codes */
  onAcknowledge?: () => void;
  /** Whether to require acknowledgment before proceeding */
  requireAcknowledge?: boolean;
}

/**
 * Display recovery codes with copy/download options.
 * Requires user acknowledgment before proceeding.
 */
export function RecoveryCodesDisplay({
  codesData,
  onAcknowledge,
  requireAcknowledge = true,
}: RecoveryCodesDisplayProps) {
  const [copied, setCopied] = React.useState(false);
  const [acknowledged, setAcknowledged] = React.useState(false);

  const handleCopy = async () => {
    const text = codesData.codes.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Recovery codes copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    const text = [
      "Clawdbrain Recovery Codes",
      `Generated: ${new Date(codesData.generatedAt).toISOString()}`,
      "",
      "Keep these codes safe. Each code can only be used once.",
      "",
      ...codesData.codes,
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clawdbrain-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Recovery codes downloaded");
  };

  return (
    <div className="space-y-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Save these codes now.</strong> They will not be shown again.
          Each code can only be used once to regain access if you lose your
          authenticator.
        </AlertDescription>
      </Alert>

      {/* Recovery codes grid */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="grid grid-cols-2 gap-2">
          {codesData.codes.map((code, index) => (
            <div
              key={index}
              className="rounded bg-background px-3 py-2 font-mono text-sm"
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-2">
        <Button type="button" variant="outline" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy all
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {/* Acknowledgment */}
      {requireAcknowledge && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <label
              htmlFor="acknowledge"
              className="text-sm leading-tight cursor-pointer"
            >
              I have saved these recovery codes in a secure location. I
              understand that if I lose access to my authenticator app and these
              codes, I will be locked out.
            </label>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!acknowledged}
            onClick={onAcknowledge}
          >
            I've saved my recovery codes
          </Button>
        </div>
      )}
    </div>
  );
}

export default RecoveryCodesDisplay;
