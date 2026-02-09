"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Pencil, Plus, Trash2 } from "lucide-react";

// ── Inline Editable Text Field ──────────────────────────────────────

interface InlineTextFieldProps {
  value: string;
  onSave: (value: string) => void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  disabled?: boolean;
}

export function InlineTextField({
  value,
  onSave,
  label,
  placeholder,
  multiline = false,
  className,
  disabled = false,
}: InlineTextFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync external value changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("space-y-1", className)}>
        {label && (
          <label className="text-xs font-medium text-muted-foreground">{label}</label>
        )}
        <div className="flex items-start gap-2">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[80px] text-sm"
              onBlur={() => {
                // Small delay to allow button clicks
                setTimeout(() => {
                  if (document.activeElement?.closest("[data-inline-actions]")) return;
                  handleSave();
                }, 150);
              }}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="text-sm"
              onBlur={() => {
                setTimeout(() => {
                  if (document.activeElement?.closest("[data-inline-actions]")) return;
                  handleSave();
                }, 150);
              }}
            />
          )}
          <div data-inline-actions className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
              onClick={handleSave}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {multiline && (
          <p className="text-[10px] text-muted-foreground">
            Press ⌘+Enter to save, Escape to cancel
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-accent/50",
        disabled && "cursor-default hover:bg-transparent",
        className,
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      {label && (
        <label className="text-xs font-medium text-muted-foreground block mb-0.5">
          {label}
        </label>
      )}
      <div className="flex items-start gap-2">
        <span className={cn("text-sm flex-1", !value && "text-muted-foreground italic")}>
          {value || placeholder || "Click to edit..."}
        </span>
        {!disabled && (
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        )}
      </div>
    </div>
  );
}

// ── Inline Editable List ──────────────────────────────────────

interface InlineListFieldProps {
  items: string[];
  onSave: (items: string[]) => void;
  label: string;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineListField({
  items,
  onSave,
  label,
  placeholder = "Add item...",
  emptyMessage = "No items yet",
  className,
  disabled = false,
}: InlineListFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editItems, setEditItems] = React.useState<string[]>(items);
  const [newItem, setNewItem] = React.useState("");
  const newItemRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isEditing) {
      setEditItems(items);
    }
  }, [items, isEditing]);

  const handleAddItem = () => {
    const trimmed = newItem.trim();
    if (trimmed) {
      setEditItems([...editItems, trimmed]);
      setNewItem("");
      newItemRef.current?.focus();
    }
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, value: string) => {
    const updated = [...editItems];
    updated[index] = value;
    setEditItems(updated);
  };

  const handleSave = () => {
    // Add any pending new item
    let finalItems = [...editItems];
    if (newItem.trim()) {
      finalItems.push(newItem.trim());
    }
    finalItems = finalItems.filter(Boolean);
    onSave(finalItems);
    setNewItem("");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditItems(items);
    setNewItem("");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">{label}</label>
          <div data-inline-actions className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-500 hover:text-green-600"
              onClick={handleSave}
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {editItems.map((item, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <span className="text-muted-foreground text-xs w-4 shrink-0">
                {index + 1}.
              </span>
              <Input
                value={item}
                onChange={(e) => handleUpdateItem(index, e.target.value)}
                className="text-sm h-8 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleRemoveItem(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs w-4 shrink-0" />
          <Input
            ref={newItemRef}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-sm h-8 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary shrink-0"
            onClick={handleAddItem}
            disabled={!newItem.trim()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-md px-2 py-1.5 -mx-2 -my-1.5 transition-colors hover:bg-accent/50",
        disabled && "cursor-default hover:bg-transparent",
        className,
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {!disabled && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-foreground">
              <span className="text-muted-foreground text-xs mt-0.5 w-4 shrink-0">
                {index + 1}.
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
      )}
    </div>
  );
}
