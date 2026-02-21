
import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Settings2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { portSchema, bindAddressSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showSuccess } from "@/lib/toast";
import { useFieldValidation } from "@/hooks/useFieldValidation";

// Gateway connection status
export type GatewayStatus = "connected" | "disconnected" | "connecting";

// Access mode options with user-friendly labels
export type AccessMode = "local" | "network" | "custom";

export interface GatewayConfigProps {
  /** Current connection status */
  status?: GatewayStatus;
  /** Port number (default: 18789) */
  port?: number;
  /** Access mode */
  accessMode?: AccessMode;
  /** Custom bind address (only used when accessMode is 'custom') */
  customBind?: string;
  /** Auth token */
  authToken?: string;
  /** Callback when config changes */
  onConfigChange?: (config: {
    port: number;
    accessMode: AccessMode;
    customBind?: string;
  }) => void;
  /** Callback to reconnect */
  onReconnect?: () => void;
  /** Additional className */
  className?: string;
}

// Status indicator with prominent visual feedback
function StatusIndicator({ status }: { status: GatewayStatus }) {
  const statusConfig = {
    connected: {
      color: "bg-green-500",
      icon: CheckCircle2,
      label: "Connected",
      textColor: "text-green-700 dark:text-green-400",
      badgeVariant: "success" as const,
    },
    disconnected: {
      color: "bg-red-500",
      icon: XCircle,
      label: "Disconnected",
      textColor: "text-red-700 dark:text-red-400",
      badgeVariant: "error" as const,
    },
    connecting: {
      color: "bg-yellow-500",
      icon: Loader2,
      label: "Connecting",
      textColor: "text-yellow-700 dark:text-yellow-400",
      badgeVariant: "warning" as const,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className={cn("h-4 w-4 rounded-full", config.color)} />
        {status === "connected" && (
          <motion.div
            className={cn(
              "absolute inset-0 h-4 w-4 rounded-full",
              config.color,
              "opacity-75"
            )}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.75, 0, 0.75],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
      <Badge variant={config.badgeVariant} className="gap-1.5 text-sm px-3 py-1">
        <Icon
          className={cn(
            "h-4 w-4",
            status === "connecting" && "animate-spin"
          )}
        />
        {config.label}
      </Badge>
    </div>
  );
}

// Access mode selector with user-friendly labels
function AccessModeSelector({
  value,
  onChange,
}: {
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
}) {
  const options = [
    {
      value: "local" as const,
      label: "Local only",
      description: "Only this computer can connect",
    },
    {
      value: "network" as const,
      label: "Anyone on network",
      description: "Other devices on your network can connect",
    },
    {
      value: "custom" as const,
      label: "Custom",
      description: "Specify a custom bind address",
    },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Access</Label>
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
              value === option.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            )}
          >
            <div
              className={cn(
                "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                value === option.value
                  ? "border-primary"
                  : "border-muted-foreground"
              )}
            >
              {value === option.value && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground">
                {option.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Token display with show/copy functionality
function TokenDisplay({ token }: { token: string }) {
  const [visible, setVisible] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    showSuccess("Token copied to clipboard");
  };

  const maskedToken = token ? "x".repeat(Math.min(token.length, 32)) : "";

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Auth Token</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={visible ? token : maskedToken}
            readOnly
            className="font-mono text-sm pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function GatewayConfig({
  status = "disconnected",
  port: initialPort = 18789,
  accessMode: initialAccessMode = "local",
  customBind: initialCustomBind = "",
  authToken = "",
  onConfigChange,
  onReconnect,
  className,
}: GatewayConfigProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [port, setPort] = React.useState(initialPort);
  const [portInput, setPortInput] = React.useState(String(initialPort));
  const [accessMode, setAccessMode] = React.useState<AccessMode>(initialAccessMode);
  const [customBind, setCustomBind] = React.useState(initialCustomBind);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [hasInteractedPort, setHasInteractedPort] = React.useState(false);
  const [hasInteractedBind, setHasInteractedBind] = React.useState(false);

  // Validate port
  const portValidation = useFieldValidation(portSchema, port, {
    debounceMs: 300,
    skipEmpty: false,
  });
  const showPortError = hasInteractedPort && !portValidation.isValid && portValidation.error;

  // Validate custom bind address (only when in custom mode)
  const bindValidation = useFieldValidation(bindAddressSchema, customBind, {
    debounceMs: 300,
    skipEmpty: true,
  });
  const showBindError = hasInteractedBind && accessMode === "custom" && !bindValidation.isValid && bindValidation.error;

  // Check if form is valid for saving
  const isFormValid = portValidation.isValid && (accessMode !== "custom" || (customBind.trim() && bindValidation.isValid));

  // Track changes
  React.useEffect(() => {
    const changed =
      port !== initialPort ||
      accessMode !== initialAccessMode ||
      customBind !== initialCustomBind;
    setHasChanges(changed);
  }, [port, accessMode, customBind, initialPort, initialAccessMode, initialCustomBind]);

  const handleSave = () => {
    if (!isFormValid) {return;}
    onConfigChange?.({ port, accessMode, customBind });
    setHasChanges(false);
    showSuccess("Gateway configuration saved");
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasInteractedPort(true);
    const inputValue = e.target.value;
    setPortInput(inputValue);
    const value = parseInt(inputValue, 10);
    if (!isNaN(value)) {
      setPort(value);
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Status hero section */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Server className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Gateway</h3>
              <StatusIndicator status={status} />
            </div>
          </div>

          {/* Quick info */}
          <div className="text-right text-sm text-muted-foreground">
            <div>Port {port}</div>
            {status === "disconnected" && onReconnect && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary"
                onClick={onReconnect}
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
          <Collapsible.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Customize
              </span>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </Button>
          </Collapsible.Trigger>

          <Collapsible.Content forceMount>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 pt-4 border-t mt-4">
                    {/* Port configuration */}
                    <div className="space-y-2">
                      <Label htmlFor="gateway-port" className="text-sm font-medium">
                        Port
                      </Label>
                      <Input
                        id="gateway-port"
                        type="number"
                        min={1024}
                        max={65535}
                        value={portInput}
                        onChange={handlePortChange}
                        className={cn(
                          "w-32",
                          showPortError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                        )}
                        aria-invalid={!!showPortError}
                      />
                      {showPortError ? (
                        <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                          {portValidation.error}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Default: 18789 (range: 1024-65535)
                        </p>
                      )}
                    </div>

                    {/* Access mode */}
                    <AccessModeSelector
                      value={accessMode}
                      onChange={setAccessMode}
                    />

                    {/* Custom bind address (only shown when custom mode selected) */}
                    <AnimatePresence>
                      {accessMode === "custom" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="custom-bind" className="text-sm font-medium">
                              Bind Address
                            </Label>
                            <Input
                              id="custom-bind"
                              type="text"
                              placeholder="0.0.0.0"
                              value={customBind}
                              onChange={(e) => {
                                setHasInteractedBind(true);
                                setCustomBind(e.target.value);
                              }}
                              className={cn(
                                showBindError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                              )}
                              aria-invalid={!!showBindError}
                            />
                            {showBindError ? (
                              <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                                {bindValidation.error}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                IP address (e.g., 0.0.0.0, 192.168.1.1) or hostname
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Auth token */}
                    {authToken && <TokenDisplay token={authToken} />}

                    {/* Save button */}
                    {hasChanges && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Button
                          onClick={handleSave}
                          className="w-full"
                          disabled={!isFormValid}
                        >
                          Save Changes
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible.Content>
        </Collapsible.Root>
      </CardContent>
    </Card>
  );
}

export default GatewayConfig;
