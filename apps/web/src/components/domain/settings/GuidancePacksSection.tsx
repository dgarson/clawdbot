"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useGuidancePackStore, type GuidancePack } from "@/stores/useGuidancePackStore";
import { BookOpen, Copy, Pencil, Plus, Trash2 } from "lucide-react";

const emptyForm = {
  name: "",
  summary: "",
  content: "",
  tags: "",
};

export function GuidancePacksSection({ className }: { className?: string }) {
  const { packs, createPack, updatePack, removePack, duplicatePack } = useGuidancePackStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPack, setEditingPack] = React.useState<GuidancePack | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const openCreate = () => {
    setEditingPack(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (pack: GuidancePack) => {
    setEditingPack(pack);
    setForm({
      name: pack.name,
      summary: pack.summary,
      content: pack.content,
      tags: pack.tags.join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (editingPack) {
      updatePack(editingPack.id, {
        name: form.name.trim() || editingPack.name,
        summary: form.summary.trim(),
        content: form.content.trim(),
        tags,
      });
    } else {
      createPack({
        name: form.name.trim() || "Untitled Pack",
        summary: form.summary.trim(),
        content: form.content.trim(),
        tags,
      });
    }
    setDialogOpen(false);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Guidance Packs
            </CardTitle>
            <CardDescription>
              Reusable instruction sets you can attach to rituals or agents.
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Pack
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {packs.map((pack) => (
          <Card key={pack.id} className="border-border/60">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{pack.name}</CardTitle>
                  {pack.summary && (
                    <CardDescription className="text-sm">
                      {pack.summary}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicatePack(pack.id)}
                    aria-label={`Duplicate ${pack.name}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(pack)}
                    aria-label={`Edit ${pack.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePack(pack.id)}
                    aria-label={`Delete ${pack.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {pack.tags.length > 0 ? (
                  pack.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Untagged
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {pack.content || "No guidance text yet."}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPack ? "Edit Guidance Pack" : "Create Guidance Pack"}</DialogTitle>
            <DialogDescription>
              Use clear, reusable instructions that can be attached to rituals or agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Weekly Report Clarity"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Summary</label>
              <Input
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Short description for quick scanning"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Guidance</label>
              <Textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Write reusable instructions (markdown supported)"
                className="min-h-[160px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <Input
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="Comma separated (e.g. tone, privacy)"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingPack ? "Save Changes" : "Create Pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GuidancePacksSection;
