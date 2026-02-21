import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DetailPanel } from "@/components/composed/DetailPanel";
import { CardSkeleton } from "@/components/composed/LoadingSkeleton";
import { ErrorState, errorMessages } from "@/components/composed/ErrorState";
import { useSkillsStatus, type Skill } from "@/hooks/queries/useSkills";
import {
  useEnableSkill,
  useDisableSkill,
  useInstallSkill,
  useUninstallSkill,
  useReloadSkills,
} from "@/hooks/mutations/useSkillMutations";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  Puzzle,
  Plus,
  RefreshCw,
  Package,
  ExternalLink,
  Settings,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Zap,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/skills/")({
  component: SkillsPage,
});

type SkillFilter = "all" | "enabled" | "disabled" | "builtin" | "custom";

function SkillsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<SkillFilter>("all");
  const [selectedSkill, setSelectedSkill] = React.useState<Skill | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isInstallOpen, setIsInstallOpen] = React.useState(false);
  const [installSource, setInstallSource] = React.useState("");
  const [uninstallDialogOpen, setUninstallDialogOpen] = React.useState(false);
  const [skillToUninstall, setSkillToUninstall] = React.useState<Skill | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Queries
  const { data: skillsReport, isLoading, error, refetch } = useSkillsStatus();

  // Mutations
  const enableSkill = useEnableSkill();
  const disableSkill = useDisableSkill();
  const installSkill = useInstallSkill();
  const uninstallSkill = useUninstallSkill();
  const reloadSkills = useReloadSkills();

  // Filtered skills
  const filteredSkills = React.useMemo(() => {
    if (!skillsReport?.skills) return [];

    let result = [...skillsReport.skills];

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.displayName.toLowerCase().includes(query) ||
          skill.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    switch (filter) {
      case "enabled":
        result = result.filter((s) => s.enabled);
        break;
      case "disabled":
        result = result.filter((s) => !s.enabled);
        break;
      case "builtin":
        result = result.filter((s) => s.builtIn);
        break;
      case "custom":
        result = result.filter((s) => !s.builtIn);
        break;
    }

    // Sort: enabled first, then alphabetical
    result.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return result;
  }, [skillsReport?.skills, debouncedSearch, filter]);

  const handleToggleSkill = (skill: Skill) => {
    if (skill.enabled) {
      disableSkill.mutate(skill.name);
    } else {
      enableSkill.mutate(skill.name);
    }
  };

  const handleInstall = () => {
    if (!installSource.trim()) return;
    installSkill.mutate(
      { source: installSource.trim() },
      {
        onSuccess: () => {
          setIsInstallOpen(false);
          setInstallSource("");
        },
      }
    );
  };

  const confirmUninstall = (skill: Skill) => {
    setSkillToUninstall(skill);
    setUninstallDialogOpen(true);
  };

  const handleUninstall = () => {
    if (skillToUninstall) {
      uninstallSkill.mutate(skillToUninstall.name, {
        onSuccess: () => {
          setUninstallDialogOpen(false);
          setSkillToUninstall(null);
          if (selectedSkill?.name === skillToUninstall.name) {
            setIsDetailOpen(false);
            setSelectedSkill(null);
          }
        },
      });
    }
  };

  const openDetail = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsDetailOpen(true);
  };

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Puzzle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
              <p className="text-muted-foreground">
                Manage capabilities available to your agents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reloadSkills.mutate()}
              disabled={reloadSkills.isPending}
              className="gap-2"
            >
              <RefreshCw
                className={cn("h-4 w-4", reloadSkills.isPending && "animate-spin")}
              />
              Reload
            </Button>
            <Button onClick={() => setIsInstallOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Install Skill
            </Button>
          </div>
        </div>

        {/* Stats */}
        {skillsReport && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{skillsReport.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Zap className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{skillsReport.enabled}</p>
                  <p className="text-xs text-muted-foreground">Enabled</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{skillsReport.builtIn}</p>
                  <p className="text-xs text-muted-foreground">Built-in</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Download className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{skillsReport.custom}</p>
                  <p className="text-xs text-muted-foreground">Custom</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as SkillFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="builtin">Built-in</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          variant="card"
          title="Failed to load skills"
          description="Could not retrieve skills from the gateway. Make sure it's running."
          onRetry={() => refetch()}
        />
      ) : filteredSkills.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Puzzle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No skills found</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              {debouncedSearch || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Install your first skill to extend agent capabilities"}
            </p>
            {!debouncedSearch && filter === "all" && (
              <Button
                onClick={() => setIsInstallOpen(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Install Skill
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence>
            {filteredSkills.map((skill, index) => (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    !skill.enabled && "opacity-60"
                  )}
                  onClick={() => openDetail(skill)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base truncate">
                            {skill.displayName}
                          </CardTitle>
                          {skill.builtIn && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Built-in
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1 line-clamp-2">
                          {skill.description || "No description available"}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(e) => {
                          e; // prevent card click
                          handleToggleSkill(skill);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 ml-3"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {skill.enabled ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>{skill.enabled ? "Active" : "Inactive"}</span>
                      </div>
                      <span className="font-mono text-xs">v{skill.version}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Skill Detail Panel */}
      <DetailPanel
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Skill Details"
        width="lg"
      >
        {selectedSkill && (
          <div className="space-y-6">
            {/* Skill header */}
            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl",
                  selectedSkill.enabled
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Puzzle className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">{selectedSkill.displayName}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedSkill.name}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={selectedSkill.enabled ? "default" : "secondary"}>
                    {selectedSkill.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  {selectedSkill.builtIn && (
                    <Badge variant="outline">Built-in</Badge>
                  )}
                  <Badge variant="outline" className="font-mono">
                    v{selectedSkill.version}
                  </Badge>
                </div>
              </div>
              <Switch
                checked={selectedSkill.enabled}
                onCheckedChange={() => handleToggleSkill(selectedSkill)}
              />
            </div>

            {/* Description */}
            {selectedSkill.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedSkill.description}
                </p>
              </div>
            )}

            {/* Source */}
            {selectedSkill.source && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Source</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                  <span className="font-mono truncate">{selectedSkill.source}</span>
                </div>
              </div>
            )}

            {/* Config */}
            {selectedSkill.config && Object.keys(selectedSkill.config).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Configuration</h4>
                <pre className="p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-auto max-h-[200px]">
                  {JSON.stringify(selectedSkill.config, null, 2)}
                </pre>
              </div>
            )}

            {/* Last Updated */}
            {selectedSkill.updatedAt && (
              <div className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(selectedSkill.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}

            {/* Actions */}
            {!selectedSkill.builtIn && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => confirmUninstall(selectedSkill)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Uninstall Skill
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      {/* Install Skill Dialog */}
      <Dialog open={isInstallOpen} onOpenChange={setIsInstallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Skill</DialogTitle>
            <DialogDescription>
              Enter the URL or path to a skill package to install it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                value={installSource}
                onChange={(e) => setInstallSource(e.target.value)}
                placeholder="https://clawhub.com/skills/my-skill or /path/to/skill"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Browse skills at{" "}
                <a
                  href="https://clawhub.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ClawhHub
                </a>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstallOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInstall}
              disabled={!installSource.trim() || installSkill.isPending}
              className="gap-2"
            >
              {installSkill.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {installSkill.isPending ? "Installing..." : "Install"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall Confirmation */}
      <Dialog open={uninstallDialogOpen} onOpenChange={setUninstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall Skill</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall{" "}
              <span className="font-medium text-foreground">
                {skillToUninstall?.displayName}
              </span>
              ? This will remove it from all agents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUninstall}
              disabled={uninstallSkill.isPending}
            >
              {uninstallSkill.isPending ? "Uninstalling..." : "Uninstall"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
