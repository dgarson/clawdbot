"use client";

import * as React from "react";
import {
  ExternalLink,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Zap,
  KeyRound,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WizardSteps } from "@/components/composed/WizardSteps";
import { ScopeSelector } from "./ScopeSelector";
import { getProviderScopes, getDefaultScopes } from "@/lib/scopes";
import type {
  ConnectionWizardData,
  ConnectionAuthField,
  ConnectionSyncOption,
} from "./ConnectionWizardDialog";

// Re-export types from the base wizard
export type {
  ConnectionWizardData,
  ConnectionAuthMethod,
  ConnectionAuthField,
  ConnectionSyncOption,
  ConnectionAuthMethodType,
} from "./ConnectionWizardDialog";

const EMPTY_SYNC_OPTIONS: ConnectionSyncOption[] = [];
const EMPTY_AUTH_FIELDS: ConnectionAuthField[] = [];

interface ConnectionWizardWithScopesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWizardData;
  onConnect: (payload: {
    authMethodId: string;
    values: Record<string, string>;
    options: Record<string, boolean>;
    scopes?: string[];
    meta?: Record<string, unknown>;
  }) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  /** Enable granular scope selection for OAuth methods */
  enableScopeSelection?: boolean;
}

function maskSecret(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 6) return "••••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
}

/**
 * Enhanced connection wizard with OAuth scope selection.
 *
 * Adds a "Permissions" step for OAuth methods when the provider
 * has granular scope configuration available.
 */
export function ConnectionWizardWithScopes({
  open,
  onOpenChange,
  connection,
  onConnect,
  onDisconnect,
  enableScopeSelection = true,
}: ConnectionWizardWithScopesProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [selectedMethodId, setSelectedMethodId] = React.useState<string>(
    connection.authMethods[0]?.id ?? ""
  );
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [options, setOptions] = React.useState<Record<string, boolean>>({});
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>([]);
  const [oauthAuthorized, setOauthAuthorized] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [tokenTestStatus, setTokenTestStatus] = React.useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [tokenTestMessage, setTokenTestMessage] = React.useState<string | null>(null);
  const [notionUserInfo, setNotionUserInfo] = React.useState<Record<string, string> | null>(null);
  const tokenTestRequestId = React.useRef(0);
  const latestTokenRef = React.useRef("");

  const method = connection.authMethods.find((m) => m.id === selectedMethodId);
  const syncOptions = connection.syncOptions ?? EMPTY_SYNC_OPTIONS;
  const showObsidianRestGuide =
    connection.id === "obsidian" && method?.id === "obsidian-rest-api";

  // Check if this provider has scope configuration
  const providerScopes = getProviderScopes(connection.id);
  const hasScopeConfig = enableScopeSelection && providerScopes && providerScopes.scopes.length > 3;
  const isOAuthMethod = method?.type === "oauth";
  const showScopesStep = isOAuthMethod && hasScopeConfig;
  const isNotionConnection = connection.id === "notion";
  const isNotionTokenMethod = isNotionConnection && method?.id === "notion-token";
  const isNotionOAuthMethod = isNotionConnection && method?.id === "notion-oauth";
  const integrationTokenValue = values.integrationToken?.trim() ?? "";
  const notionTokenFormatInvalid =
    isNotionTokenMethod && integrationTokenValue.length > 0 && !integrationTokenValue.startsWith("secret_");

  // Reset state when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setCurrentStep(0);
    setSelectedMethodId(connection.authMethods[0]?.id ?? "");
    setValues({});
    setOauthAuthorized(false);
    setIsConnecting(false);
    setIsDisconnecting(false);
    setTokenTestStatus("idle");
    setTokenTestMessage(null);
    setNotionUserInfo(null);
    setOptions(
      syncOptions.reduce<Record<string, boolean>>((acc, option) => {
        acc[option.id] = option.defaultEnabled ?? true;
        return acc;
      }, {})
    );
    // Initialize scopes with defaults
    const defaults = getDefaultScopes(connection.id);
    setSelectedScopes(defaults);
  }, [open, connection.authMethods, connection.id, syncOptions]);

  React.useEffect(() => {
    setTokenTestStatus("idle");
    setTokenTestMessage(null);
    setNotionUserInfo(null);
  }, [selectedMethodId]);

  React.useEffect(() => {
    if (!isNotionTokenMethod) return;
    setTokenTestStatus("idle");
    setTokenTestMessage(null);
    setNotionUserInfo(null);
  }, [integrationTokenValue, isNotionTokenMethod]);

  React.useEffect(() => {
    latestTokenRef.current = integrationTokenValue;
  }, [integrationTokenValue]);

  // Build steps list based on method type
  const steps = React.useMemo(() => {
    const list = ["Method"];
    if (showScopesStep) {
      list.push("Permissions");
    }
    list.push("Access");
    if (syncOptions.length > 0) {
      list.push("Preferences");
    }
    list.push("Review");
    return list;
  }, [showScopesStep, syncOptions.length]);

  const stepId = steps[currentStep] ?? steps[0];
  const authFields = method?.fields ?? EMPTY_AUTH_FIELDS;

  const isAccessComplete = React.useMemo(() => {
    if (!method) return false;
    if (method.type === "oauth") return oauthAuthorized;
    const requiredFields = authFields.filter((field) => field.required !== false);
    const hasRequiredValues = requiredFields.every((field) => values[field.id]?.trim());
    if (isNotionTokenMethod) {
      return hasRequiredValues && !notionTokenFormatInvalid && tokenTestStatus === "success";
    }
    return hasRequiredValues;
  }, [authFields, method, notionTokenFormatInvalid, oauthAuthorized, tokenTestStatus, values, isNotionTokenMethod]);

  const canProceed = React.useMemo(() => {
    if (stepId === "Method") return !!method;
    if (stepId === "Permissions") return selectedScopes.length > 0;
    if (stepId === "Access") return isAccessComplete;
    return true;
  }, [stepId, method, selectedScopes.length, isAccessComplete]);

  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (!canProceed) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleConnect = async () => {
    if (!method || !isAccessComplete) return;
    setIsConnecting(true);
    try {
      await onConnect({
        authMethodId: method.id,
        values,
        options,
        scopes: isOAuthMethod ? selectedScopes : undefined,
        meta: isNotionTokenMethod && notionUserInfo ? { notionUserInfo } : undefined,
      });
      showSuccess(`${connection.name} connected successfully`);
      onOpenChange(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      showSuccess(`${connection.name} disconnected`);
      onOpenChange(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestNotionToken = async () => {
    if (!integrationTokenValue || notionTokenFormatInvalid) return;
    const requestToken = integrationTokenValue;
    const requestId = tokenTestRequestId.current + 1;
    tokenTestRequestId.current = requestId;
    setTokenTestStatus("testing");
    setTokenTestMessage(null);
    setNotionUserInfo(null);

    try {
      const response = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${integrationTokenValue}`,
          "Notion-Version": "2022-06-28",
        },
      });

      if (!response.ok) {
        throw new Error("Notion rejected the token. Double-check capabilities and shared pages.");
      }

      const data = (await response.json()) as {
        id?: string;
        name?: string;
        bot?: {
          workspace_name?: string;
          owner?: {
            user?: {
              name?: string;
              person?: { email?: string };
            };
          };
        };
      };

      const workspaceName = data.bot?.workspace_name ?? data.name ?? "Notion workspace";
      const ownerUser = data.bot?.owner?.user;
      const ownerName = ownerUser?.name ?? data.name ?? "Notion user";
      const ownerEmail = ownerUser?.person?.email;

      if (tokenTestRequestId.current !== requestId || latestTokenRef.current !== requestToken) {
        return;
      }

      const userInfo: Record<string, string> = {
        name: workspaceName,
        username: ownerName,
      };
      if (ownerEmail) {
        userInfo.email = ownerEmail;
      }
      setNotionUserInfo(userInfo);
      setTokenTestStatus("success");
      setTokenTestMessage(
        ownerEmail
          ? `Connected to ${workspaceName} as ${ownerName} (${ownerEmail}).`
          : `Connected to ${workspaceName} as ${ownerName}.`
      );
    } catch (error) {
      if (tokenTestRequestId.current !== requestId || latestTokenRef.current !== requestToken) {
        return;
      }
      setTokenTestStatus("error");
      setTokenTestMessage(
        error instanceof Error
          ? error.message
          : "Unable to verify the token. Please try again."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {connection.icon}
            </div>
            <div>
              <DialogTitle>{connection.name}</DialogTitle>
              <DialogDescription>{connection.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <WizardSteps steps={steps} currentStep={currentStep} onStepChange={setCurrentStep} />

          {/* Method selection step */}
          {stepId === "Method" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose how you want to authenticate. You can switch methods later.
              </p>
              <div className="grid gap-3">
                {connection.authMethods.map((auth) => {
                  const isSelected = auth.id === selectedMethodId;
                  return (
                    <button
                      key={auth.id}
                      type="button"
                      onClick={() => setSelectedMethodId(auth.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                        isSelected
                          ? "border-primary/60 bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        {auth.type === "oauth" ? (
                          <Zap className="h-4 w-4 text-primary" />
                        ) : auth.type === "api_key" ? (
                          <KeyRound className="h-4 w-4 text-primary" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{auth.label}</p>
                          {auth.badge && (
                            <Badge variant="secondary" className="text-[10px]">
                              {auth.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{auth.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permissions/Scopes step (OAuth only) */}
          {stepId === "Permissions" && showScopesStep && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the permissions you want to grant {connection.name}. You can change these later.
              </p>
              <ScopeSelector
                providerId={connection.id}
                selectedScopes={selectedScopes}
                onScopesChange={setSelectedScopes}
              />
            </div>
          )}

          {/* Access step */}
          {stepId === "Access" && method && (
            <div
              className={cn(
                "space-y-4",
                isNotionConnection && "lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-4 lg:space-y-0"
              )}
            >
              <div className="space-y-4">
                {method.type === "oauth" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Authorize with {connection.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          You will be redirected to {connection.name} to approve access.
                          {isNotionOAuthMethod && " Notion will ask you to select the pages to share."}
                        </p>
                      </div>
                      {selectedScopes.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Requested permissions:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedScopes.slice(0, 6).map((scopeId) => {
                              const scope = providerScopes?.scopes.find((s) => s.id === scopeId);
                              return (
                                <Badge key={scopeId} variant="outline" className="text-[10px]">
                                  {scope?.label ?? scopeId}
                                </Badge>
                              );
                            })}
                            {selectedScopes.length > 6 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{selectedScopes.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {isNotionOAuthMethod && (
                        <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-muted-foreground">
                          <Info className="mt-0.5 h-3.5 w-3.5 text-blue-600" />
                          Notion will prompt you to choose which pages to share with this integration.
                        </div>
                      )}
                    </div>
                    <Button onClick={() => setOauthAuthorized(true)} className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {method.ctaLabel ?? `Continue with ${connection.name}`}
                    </Button>
                    {isNotionOAuthMethod && (
                      <a
                        href="https://developers.notion.com/docs/authorization"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        View Notion OAuth docs
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {method.ctaHint && (
                      <p className="text-xs text-muted-foreground text-center">{method.ctaHint}</p>
                    )}
                    {oauthAuthorized && (
                      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Authorization received. Continue to finish setup.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isNotionTokenMethod ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a
                              href="https://www.notion.so/my-integrations"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Create Integration
                            </a>
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Create an internal integration and copy the secret.
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${connection.id}-integrationToken`}>
                            Integration Token
                          </Label>
                          <Input
                            id={`${connection.id}-integrationToken`}
                            type="password"
                            placeholder="secret_xxxxxxxxxxxxxx"
                            value={values.integrationToken ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({
                                ...prev,
                                integrationToken: event.target.value,
                              }))
                            }
                            aria-invalid={notionTokenFormatInvalid}
                            className={cn(notionTokenFormatInvalid && "border-red-500/60")}
                          />
                          {notionTokenFormatInvalid && (
                            <p className="text-xs text-red-600">
                              Tokens must start with <span className="font-mono">secret_</span>.
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${connection.id}-workspaceId`}>
                            Workspace ID (optional)
                          </Label>
                          <Input
                            id={`${connection.id}-workspaceId`}
                            placeholder="workspace-id"
                            value={values.workspaceId ?? ""}
                            onChange={(event) =>
                              setValues((prev) => ({ ...prev, workspaceId: event.target.value }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Found in your workspace URL: notion.so/{"{workspace_id}"}/...
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleTestNotionToken}
                            disabled={tokenTestStatus === "testing" || !integrationTokenValue || notionTokenFormatInvalid}
                          >
                            {tokenTestStatus === "testing" && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Test Connection
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Verify the token before saving.
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          If the test is blocked by your network, you can still save and check the
                          connection status later.
                        </p>
                        {tokenTestMessage && (
                          <div
                            className={cn(
                              "flex items-start gap-2 rounded-lg border p-3 text-xs",
                              tokenTestStatus === "success"
                                ? "border-green-500/30 bg-green-500/10 text-green-700"
                                : "border-red-500/30 bg-red-500/10 text-red-700"
                            )}
                          >
                            <Info className="mt-0.5 h-3.5 w-3.5" />
                            <span>{tokenTestMessage}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      authFields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <Label htmlFor={`${connection.id}-${field.id}`}>{field.label}</Label>
                          {field.multiline ? (
                            <Textarea
                              id={`${connection.id}-${field.id}`}
                              rows={field.rows ?? 4}
                              placeholder={field.placeholder}
                              value={values[field.id] ?? ""}
                              onChange={(event) =>
                                setValues((prev) => ({ ...prev, [field.id]: event.target.value }))
                              }
                            />
                          ) : (
                            <Input
                              id={`${connection.id}-${field.id}`}
                              type={field.type ?? "text"}
                              placeholder={field.placeholder}
                              value={values[field.id] ?? ""}
                              onChange={(event) =>
                                setValues((prev) => ({ ...prev, [field.id]: event.target.value }))
                              }
                            />
                          )}
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {isNotionConnection && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Notion setup checklist</p>
                    {isNotionOAuthMethod ? (
                      <ol className="space-y-1 list-decimal list-inside">
                        <li>Click “Continue with Notion”.</li>
                        <li>Select the pages to share with this integration.</li>
                        <li>Return here after Notion redirects you back.</li>
                      </ol>
                    ) : (
                      <ol className="space-y-1 list-decimal list-inside">
                        <li>Create an integration at notion.so/my-integrations.</li>
                        <li>Enable the capabilities you need.</li>
                        <li>Copy the internal integration secret.</li>
                        <li>Share the relevant pages with the integration.</li>
                      </ol>
                    )}
                  </div>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700">
                    Internal integrations can only access pages explicitly shared with them.
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Docs
                    </p>
                    <div className="space-y-2">
                      {[
                        { label: "Notion Developer Docs", href: "https://developers.notion.com/" },
                        { label: "My Integrations", href: "https://www.notion.so/my-integrations" },
                        { label: "Authorization Guide", href: "https://developers.notion.com/docs/authorization" },
                        { label: "Getting Started", href: "https://developers.notion.com/docs/getting-started" },
                      ].map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!isNotionConnection && showObsidianRestGuide && (
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
                  <p className="font-medium">Local REST API setup</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                    <li>Install the Local REST API community plugin.</li>
                    <li>Enable the plugin in your Obsidian vault.</li>
                    <li>Copy the API key into the field above.</li>
                  </ol>
                  <div className="mt-3 space-y-1">
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href="https://help.obsidian.md/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Obsidian Help
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href="https://github.com/coddingtonbear/obsidian-local-rest-api"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Local REST API Plugin
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href="https://obsidian.md/plugins"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Community Plugins
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preferences step */}
          {stepId === "Preferences" && syncOptions.length > 0 && (
            <div className="space-y-3">
              {syncOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  <Switch
                    checked={options[option.id] ?? false}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, [option.id]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* Review step */}
          {stepId === "Review" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium">Summary</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Auth method</span>
                    <span className="font-medium">{method?.label}</span>
                  </div>
                  {isOAuthMethod && selectedScopes.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Permissions</span>
                      <span className="font-medium">{selectedScopes.length} scopes</span>
                    </div>
                  )}
                  {method?.fields && method.fields.length > 0 && (
                    <div className="space-y-2">
                      {method.fields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{field.label}</span>
                          <span className="font-medium">
                            {field.type === "password"
                              ? maskSecret(values[field.id] ?? "")
                              : values[field.id] || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {syncOptions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">Sync preferences</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {syncOptions
                          .filter((option) => options[option.id])
                          .map((option) => (
                            <Badge key={option.id} variant="outline" className="text-[10px]">
                              {option.label}
                            </Badge>
                          ))}
                        {syncOptions.every((option) => !options[option.id]) && (
                          <span className="text-xs text-muted-foreground">
                            No sync options enabled
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {connection.connected && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                  <CheckCircle2 className="mr-2 inline h-4 w-4 text-green-600" />
                  {connection.name} is already connected.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          {connection.connected && onDisconnect && (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isConnecting}
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
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {!isLastStep ? (
            <Button onClick={handleNext} disabled={!canProceed}>
              Next
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={!isAccessComplete || isConnecting}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connection.connected ? "Update" : "Connect"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectionWizardWithScopes;
