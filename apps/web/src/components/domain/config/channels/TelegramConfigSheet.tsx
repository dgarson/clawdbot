
import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ExternalLink, ChevronDown, CheckCircle2, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { telegramBotTokenSchema } from "@/lib/validation";
import { showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WizardSteps } from "@/components/composed/WizardSteps";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { TelegramIcon } from "./icons";
import type { TelegramConfig } from "./types";

interface TelegramConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: TelegramConfig;
  onSave: (config: TelegramConfig) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  isConnected?: boolean;
}

export function TelegramConfigSheet({
  open,
  onOpenChange,
  config,
  onSave,
  onDisconnect,
  isConnected,
}: TelegramConfigSheetProps) {
  const [botToken, setBotToken] = React.useState(config?.botToken ?? "");
  const [mode, setMode] = React.useState<TelegramConfig["mode"]>(config?.mode ?? "polling");
  const [webhookUrl, setWebhookUrl] = React.useState(config?.webhookUrl ?? "");
  const [allowFrom, setAllowFrom] = React.useState(
    config?.allowFrom ? config.allowFrom.join("\n") : ""
  );
  const [allowUnmentionedGroups, setAllowUnmentionedGroups] = React.useState(
    config?.allowUnmentionedGroups ?? false
  );
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = React.useState(false);

  // Validate bot token
  const tokenValidation = useFieldValidation(telegramBotTokenSchema, botToken, {
    debounceMs: 300,
    skipEmpty: true,
  });
  const showValidationError = hasInteracted && !tokenValidation.isValid && tokenValidation.error;

  React.useEffect(() => {
    if (open) {
      setBotToken(config?.botToken ?? "");
      setMode(config?.mode ?? "polling");
      setWebhookUrl(config?.webhookUrl ?? "");
      setAllowFrom(config?.allowFrom ? config.allowFrom.join("\n") : "");
      setAllowUnmentionedGroups(config?.allowUnmentionedGroups ?? false);
      setCurrentStep(0);
      setHasInteracted(false);
      setShowSaveConfirmation(false);
      setHelpOpen(false);
    }
  }, [open, config]);

  const handleSave = async () => {
    if (!botToken.trim()) {return;}
    setIsSaving(true);
    try {
      await onSave({
        botToken: botToken.trim(),
        mode,
        webhookUrl: mode === "webhook" ? webhookUrl.trim() || undefined : undefined,
        allowFrom: allowFrom
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
        allowUnmentionedGroups,
      });
      setShowSaveConfirmation(true);
      showSuccess("Telegram bot token saved successfully");
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } finally {
      setIsSaving(false);
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

  const steps = ["Access", "Behavior", "Review"];
  const isReviewStep = currentStep === steps.length - 1;
  const canProceedFromAccess = !!botToken.trim() && tokenValidation.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#0088cc20" }}
            >
              <TelegramIcon className="h-5 w-5" style={{ color: "#0088cc" }} />
            </div>
            <div>
              <DialogTitle>Telegram</DialogTitle>
              <DialogDescription>Configure your Telegram bot</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <WizardSteps steps={steps} currentStep={currentStep} onStepChange={setCurrentStep} />

          {/* Save confirmation */}
          <AnimatePresence>
            {showSaveConfirmation && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-green-500/30 bg-green-500/10 p-3"
              >
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Token saved successfully</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegram-token">Bot Token</Label>
                <Input
                  id="telegram-token"
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={botToken}
                  onChange={(e) => {
                    setHasInteracted(true);
                    setBotToken(e.target.value);
                  }}
                  className={cn(
                    showValidationError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                  )}
                  aria-invalid={!!showValidationError}
                />
                {showValidationError ? (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                    {tokenValidation.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Get your bot token from{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      @BotFather
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Connection Mode</Label>
                <Select value={mode ?? "polling"} onValueChange={(value) => setMode(value as TelegramConfig["mode"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polling">Long polling (recommended)</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === "webhook" && (
                <div className="space-y-2">
                  <Label htmlFor="telegram-webhook">Webhook URL</Label>
                  <Input
                    id="telegram-webhook"
                    type="url"
                    placeholder="https://your-gateway.example.com/telegram/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a publicly reachable HTTPS endpoint for Telegram to deliver updates.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="telegram-allowlist">Allowed senders (optional)</Label>
                <Textarea
                  id="telegram-allowlist"
                  rows={4}
                  placeholder="@username\\n123456789"
                  value={allowFrom}
                  onChange={(e) => setAllowFrom(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add usernames or numeric IDs. Leave blank to allow all.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Allow unmentioned group messages</p>
                  <p className="text-xs text-muted-foreground">
                    Respond even if the bot is not mentioned in a group.
                  </p>
                </div>
                <Switch
                  checked={allowUnmentionedGroups}
                  onCheckedChange={setAllowUnmentionedGroups}
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-medium">{mode === "webhook" ? "Webhook" : "Polling"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Webhook URL</span>
                <span className="font-medium">{webhookUrl || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Allowlist</span>
                <span className="font-medium">{allowFrom.trim() ? "Configured" : "All users"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Group behavior</span>
                <span className="font-medium">{allowUnmentionedGroups ? "Allow without mention" : "Mentions only"}</span>
              </div>
            </div>
          )}

          {/* Help section */}
          <Collapsible.Root open={helpOpen} onOpenChange={setHelpOpen}>
            <Collapsible.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  How to get your bot token
                </span>
                <motion.div
                  animate={{ rotate: helpOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            </Collapsible.Trigger>

            <Collapsible.Content forceMount>
              <AnimatePresence initial={false}>
                {helpOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-border bg-muted/50 p-4 mt-2 space-y-3">
                      <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                        <li>Open Telegram and search for <span className="font-medium text-foreground">@BotFather</span></li>
                        <li>Send the command <code className="bg-muted px-1 py-0.5 rounded">/newbot</code></li>
                        <li>Follow the prompts to name your bot</li>
                        <li>BotFather will send you a token that looks like:<br />
                          <code className="bg-muted px-1 py-0.5 rounded text-xs">123456789:ABCdefGHI...</code>
                        </li>
                        <li>Copy and paste that token above</li>
                      </ol>
                      <div className="pt-2 border-t border-border">
                        <a
                          href="https://core.telegram.org/bots#how-do-i-create-a-bot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Read the official documentation
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Collapsible.Content>
          </Collapsible.Root>
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          {isConnected && onDisconnect && (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSaving}
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {currentStep > 0 && (
            <Button variant="outline" onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}>
              Back
            </Button>
          )}
          {isReviewStep ? (
            <Button
              onClick={handleSave}
              disabled={isSaving || !botToken.trim() || !tokenValidation.isValid}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isConnected ? "Update" : "Connect"}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
              disabled={currentStep === 0 && !canProceedFromAccess}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
