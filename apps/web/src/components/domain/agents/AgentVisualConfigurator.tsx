import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { Check, Save, AlertCircle } from "lucide-react";

// Popular emoji grid (20 emojis)
const POPULAR_EMOJIS = [
  "🤖", "🧠", "⚡", "🎯", "💡",
  "🚀", "🔥", "✨", "🌟", "💫",
  "🎨", "🎵", "📝", "📊", "🔧",
  "🛠️", "📚", "🔬", "💻", "🎮"
];

// Model options
const MODEL_OPTIONS = [
  { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic", tier: "Balanced", recommended: true },
  { id: "claude-opus", name: "Claude Opus", provider: "Anthropic", tier: "Powerful", recommended: false },
  { id: "claude-haiku", name: "Claude Haiku", provider: "Anthropic", tier: "Fast", recommended: false },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", tier: "Balanced", recommended: false },
  { id: "gemini-flash", name: "Gemini Flash", provider: "Google", tier: "Fast", recommended: false },
];

// Thinking levels
const THINKING_LEVELS = ["Off", "Low", "Medium", "High"] as const;
type ThinkingLevel = typeof THINKING_LEVELS[number];

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  emoji: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  memoryFiles: string[];
}

interface AgentVisualConfiguratorProps {
  agentId: string;
}

export function AgentVisualConfigurator({ agentId }: AgentVisualConfiguratorProps) {
  const gateway = useOptionalGateway();
  const client = gateway?.isConnected ? gateway.client : null;

  const [config, setConfig] = React.useState<AgentConfig>({
    name: "",
    role: "",
    description: "",
    emoji: "🤖",
    model: "claude-sonnet",
    thinkingLevel: "Medium",
    memoryFiles: [],
  });

  const [originalConfig, setOriginalConfig] = React.useState<AgentConfig>(config);
  const [workspaceFiles, setWorkspaceFiles] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved" | "error">("idle");

  // Check if there are unsaved changes
  const hasChanges = React.useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  }, [config, originalConfig]);

  // Load initial config and workspace files
  React.useEffect(() => {
    async function loadConfig() {
      if (!client) {
        setIsLoading(false);
        return;
      }

      try {
        // Load agent config
        const configResponse = await client.request("config.get", {});
        if (configResponse?.config) {
          const loadedConfig: AgentConfig = {
            name: configResponse.config.name || "",
            role: configResponse.config.role || "",
            description: configResponse.config.description || "",
            emoji: configResponse.config.emoji || "🤖",
            model: configResponse.config.model || "claude-sonnet",
            thinkingLevel: configResponse.config.thinkingLevel || "Medium",
            memoryFiles: configResponse.config.memoryFiles || [],
          };
          setConfig(loadedConfig);
          setOriginalConfig(loadedConfig);
        }

        // Load workspace files
        const filesResponse = await client.request("agents.files.list", {});
        if (filesResponse?.files) {
          setWorkspaceFiles(filesResponse.files);
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadConfig();
  }, [client, agentId]);

  // Debounced save
  const debouncedSave = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return async () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (!client || !hasChanges) return;

        setIsSaving(true);
        setSaveStatus("idle");

        try {
          const patch = {
            name: config.name,
            role: config.role,
            description: config.description,
            emoji: config.emoji,
            model: config.model,
            thinkingLevel: config.thinkingLevel,
            memoryFiles: config.memoryFiles,
          };

          await client.request("config.set", { patch });
          setOriginalConfig(config);
          setSaveStatus("saved");

          // Clear saved status after 3 seconds
          setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (error) {
          console.error("Failed to save config:", error);
          setSaveStatus("error");
        } finally {
          setIsSaving(false);
        }
      }, 500);
    };
  }, [client, config, hasChanges]);

  const handleSave = () => {
    debouncedSave();
  };

  const updateConfig = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMemoryFile = (file: string) => {
    setConfig((prev) => ({
      ...prev,
      memoryFiles: prev.memoryFiles.includes(file)
        ? prev.memoryFiles.filter((f) => f !== file)
        : [...prev.memoryFiles, file],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unsaved changes indicator */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
        >
          <AlertCircle className="h-4 w-4" />
          Unsaved changes
        </motion.div>
      )}

      {/* Identity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => updateConfig("name", e.target.value)}
              placeholder="Agent name"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={config.role}
              onChange={(e) => updateConfig("role", e.target.value)}
              placeholder="e.g., Product Engineer"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={config.description}
              onChange={(e) => updateConfig("description", e.target.value)}
              placeholder="Brief description of the agent's purpose and capabilities"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Emoji Picker */}
          <div className="space-y-2">
            <Label>Avatar Emoji</Label>
            <div className="grid grid-cols-10 gap-2">
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => updateConfig("emoji", emoji)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-all hover:scale-110",
                    config.emoji === emoji
                      ? "bg-primary ring-2 ring-primary ring-offset-2"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Model</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODEL_OPTIONS.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => updateConfig("model", model.id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50",
                  config.model === model.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <div>
                    <div className="font-semibold">{model.name}</div>
                    <div className="text-sm text-muted-foreground">{model.provider}</div>
                  </div>
                  {model.recommended && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      model.tier === "Fast" && "border-green-500/30 text-green-600 dark:text-green-400",
                      model.tier === "Balanced" && "border-blue-500/30 text-blue-600 dark:text-blue-400",
                      model.tier === "Powerful" && "border-purple-500/30 text-purple-600 dark:text-purple-400"
                    )}
                  >
                    {model.tier}
                  </Badge>
                  {config.model === model.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Thinking Level Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thinking Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-flex rounded-lg border p-1">
            {THINKING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateConfig("thinkingLevel", level)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-all",
                  config.thinkingLevel === level
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Controls how much reasoning the model performs before responding
          </p>
        </CardContent>
      </Card>

      {/* Memory Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Memory Files</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select workspace files to load into the agent's context
          </p>
        </CardHeader>
        <CardContent>
          {workspaceFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspace files available</p>
          ) : (
            <div className="space-y-2">
              {workspaceFiles.map((file) => (
                <label
                  key={file}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={config.memoryFiles.includes(file)}
                    onCheckedChange={() => toggleMemoryFile(file)}
                  />
                  <span className="text-sm font-mono">{file}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>

        {saveStatus === "saved" && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
          >
            <Check className="h-4 w-4" />
            Saved ✓
          </motion.div>
        )}

        {saveStatus === "error" && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            Failed to save
          </motion.div>
        )}
      </div>
    </div>
  );
}
