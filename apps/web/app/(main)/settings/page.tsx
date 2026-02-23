"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiencyStore } from "@/lib/stores/proficiency";
import { useUiStore } from "@/lib/stores/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { ThemePreviewCards } from "@/components/shell/theme-preview";
import {
  Settings,
  Palette,
  Shield,
  Sparkles,
  Gauge,
  Save,
  RefreshCw,
  AlertCircle,
  Check,
  FileCode,
  Loader2,
  Info,
  ChevronRight,
} from "lucide-react";

type SettingsSection = "general" | "appearance" | "config" | "about";

function SectionButton({
  label,
  description,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );
}

export default function SettingsPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const hello = useGatewayStore((s) => s.hello);
  const snapshot = useGatewayStore((s) => s.snapshot);

  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const profLevel = useProficiencyStore((s) => s.level);
  const setProfLevel = useProficiencyStore((s) => s.setLevel);

  const [section, setSection] = React.useState<SettingsSection>("general");
  const [configRaw, setConfigRaw] = React.useState("");
  const [configOriginal, setConfigOriginal] = React.useState("");
  const [configLoading, setConfigLoading] = React.useState(false);
  const [configSaving, setConfigSaving] = React.useState(false);
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = React.useState(false);

  // Load config
  const loadConfig = React.useCallback(async () => {
    if (!connected) {return;}
    setConfigLoading(true);
    try {
      const result = await request<{ raw: string; hash: string }>("config.get", {});
      setConfigRaw(result.raw);
      setConfigOriginal(result.raw);
    } catch {
      setConfigError("Failed to load configuration");
    } finally {
      setConfigLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    if (section === "config") {
      void loadConfig();
    }
  }, [section, loadConfig]);

  const handleSaveConfig = async () => {
    if (!connected || configSaving) {return;}
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);

    try {
      await request("config.apply", {
        raw: configRaw,
        sessionKey: "settings-ui",
        note: "Updated via Settings UI",
      });
      setConfigOriginal(configRaw);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setConfigSaving(false);
    }
  };

  const configDirty = configRaw !== configOriginal;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <AdaptiveLabel
            beginner="Customize your OpenClaw experience"
            standard="Application and gateway configuration"
            expert="Configuration management"
          />
        </p>
      </div>

      <div className="flex gap-6">
        {/* Section nav */}
        <div className="w-56 shrink-0 space-y-1">
          <SectionButton
            label="General"
            description="Interface preferences"
            icon={Settings}
            active={section === "general"}
            onClick={() => setSection("general")}
          />
          <SectionButton
            label="Appearance"
            description="Theme and display"
            icon={Palette}
            active={section === "appearance"}
            onClick={() => setSection("appearance")}
          />
          <ComplexityGate level="standard">
            <SectionButton
              label="Configuration"
              description="Gateway config file"
              icon={FileCode}
              active={section === "config"}
              onClick={() => setSection("config")}
            />
          </ComplexityGate>
          <SectionButton
            label="About"
            description="Version and system info"
            icon={Info}
            active={section === "about"}
            onClick={() => setSection("about")}
          />
        </div>

        {/* Section content */}
        <div className="flex-1 min-w-0">
          {section === "general" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Interface Complexity</CardTitle>
                  <CardDescription>
                    Control how much detail and how many features are visible in the interface.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(["beginner", "standard", "expert"] as const).map((level) => {
                    const config = {
                      beginner: {
                        icon: Sparkles,
                        label: "Simple",
                        desc: "Minimal options, guided experience, tooltips everywhere",
                      },
                      standard: {
                        icon: Gauge,
                        label: "Standard",
                        desc: "Balanced feature set for regular users",
                      },
                      expert: {
                        icon: Shield,
                        label: "Expert",
                        desc: "Full access to all features, raw editors, dense layouts",
                      },
                    }[level];

                    return (
                      <button
                        key={level}
                        onClick={() => setProfLevel(level)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          profLevel === level
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <config.icon className={`h-5 w-5 ${profLevel === level ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="text-left">
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{config.desc}</p>
                        </div>
                        {profLevel === level && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "appearance" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Theme</CardTitle>
                  <CardDescription>Choose your preferred color scheme.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemePreviewCards current={theme} onChange={setTheme} />
                </CardContent>
              </Card>
            </div>
          )}

          {section === "config" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Gateway Configuration</CardTitle>
                      <CardDescription>
                        Edit the OpenClaw gateway configuration file directly.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={loadConfig} disabled={configLoading}>
                        <RefreshCw className={`h-3 w-3 mr-1 ${configLoading ? "animate-spin" : ""}`} />
                        Reload
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveConfig}
                        disabled={!configDirty || configSaving}
                      >
                        {configSaving ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : configSuccess ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Saved!
                          </>
                        ) : (
                          <>
                            <Save className="h-3 w-3 mr-1" />
                            Save & Apply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {configLoading ? (
                    <div className="h-64 bg-muted rounded-lg animate-pulse" />
                  ) : (
                    <Textarea
                      value={configRaw}
                      onChange={(e) => setConfigRaw(e.target.value)}
                      className="font-mono text-sm min-h-[400px] resize-y"
                      placeholder="Loading configuration..."
                    />
                  )}
                  {configError && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {configError}
                    </div>
                  )}
                  {configDirty && (
                    <p className="text-xs text-warning mt-2">
                      ⚠ Unsaved changes. Save & Apply will restart the gateway.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "about" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">About OpenClaw</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gateway Version</p>
                      <p className="font-medium">
                        {hello?.server?.version ?? "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Protocol</p>
                      <p className="font-medium">v{hello?.protocol ?? "?"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Host</p>
                      <p className="font-medium">{hello?.server?.host ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Connection ID</p>
                      <p className="font-mono text-xs">
                        {hello?.server?.connId ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Auth Mode</p>
                      <p className="font-medium">{snapshot?.authMode ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">
                        {snapshot?.uptimeMs
                          ? `${Math.floor(snapshot.uptimeMs / 3_600_000)}h ${Math.floor((snapshot.uptimeMs % 3_600_000) / 60_000)}m`
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {snapshot?.updateAvailable && (
                    <div className="flex items-center gap-2 p-3 bg-accent rounded-lg mt-4">
                      <Info className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Update Available</p>
                        <p className="text-xs text-muted-foreground">
                          {snapshot.updateAvailable.currentVersion} → {snapshot.updateAvailable.latestVersion}
                          ({snapshot.updateAvailable.channel})
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">UI Version</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frontend</span>
                    <span className="font-medium">Horizon v0.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Framework</span>
                    <span className="font-medium">Next.js 15 + React 19</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
