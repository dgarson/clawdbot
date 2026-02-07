"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QRCodeDisplayProps {
  /** QR code as data URL or image URL */
  qrCodeDataUrl: string;
  /** Base32 secret for manual entry */
  secret: string;
  /** Account name for display */
  accountName?: string;
}

/**
 * Display QR code for authenticator app setup.
 * Includes manual entry fallback with copy button.
 */
export function QRCodeDisplay({
  qrCodeDataUrl,
  secret,
  accountName = "Clawdbrain",
}: QRCodeDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Secret copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Format secret in groups of 4 for readability
  const formattedSecret = secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <div className="flex justify-center">
        <div className="rounded-lg border bg-white p-4">
          <img
            src={qrCodeDataUrl}
            alt="QR Code for authenticator app"
            className="h-48 w-48"
          />
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          Scan this QR code with your authenticator app
          <br />
          (Google Authenticator, 1Password, Authy, etc.)
        </p>
      </div>

      {/* Manual entry fallback */}
      <div className="space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          Can't scan? Enter this key manually:
        </p>
        <div className="flex items-center justify-center gap-2">
          <code className="rounded bg-muted px-3 py-2 font-mono text-sm">
            {formattedSecret}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Account: {accountName}
        </p>
      </div>
    </div>
  );
}

export default QRCodeDisplay;
