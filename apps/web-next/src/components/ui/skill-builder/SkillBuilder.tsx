import React, { useState, useCallback } from 'react';
import { cn } from '../../../lib/utils';
import {
  Code, Play, Settings, FileText, ChevronRight, ChevronDown,
  Check, AlertCircle, Loader2
} from 'lucide-react';

// Skill metadata
export interface SkillMetadata {
  id?: string;
  name: string;
  description: string;
  triggers: string[];
  version: string;
  author?: string;
  tags: string[];
}

// Skill definition (YAML content)
export interface SkillDefinition {
  yaml: string;
  json?: Record<string, unknown>;
}

// Test result
export interface TestResult {
  success: boolean;
  message: string;
  duration?: number;
  output?: string;
}

// Props
export interface SkillBuilderProps {
  initialMetadata?: SkillMetadata;
  initialDefinition?: SkillDefinition;
  onSave?: (metadata: SkillMetadata, definition: SkillDefinition) => void;
  onTest?: (definition: SkillDefinition) => Promise<TestResult>;
  disabled?: boolean;
  className?: string;
}

/**
 * Skill Builder IDE - Split-pane layout with metadata form, YAML editor, and preview/test panel
 */
export function SkillBuilder({
  initialMetadata,
  initialDefinition,
  onSave,
  onTest,
  disabled = false,
  className,
}: SkillBuilderProps) {
  // State
  const [metadata, setMetadata] = useState<SkillMetadata>(initialMetadata ?? {
    name: '',
    description: '',
    triggers: [],
    version: '1.0.0',
    tags: [],
  });
  
  const [definition, setDefinition] = useState<SkillDefinition>(initialDefinition ?? {
    yaml: `# Skill Definition
name: my-skill
description: A new skill
triggers:
  - /my-command
actions:
  - type: prompt
    prompt: "Hello, how can I help?"
`,
  });
  
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'metadata' | 'yaml' | 'preview'>('metadata');
  const [triggerInput, setTriggerInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Handlers
  const handleMetadataChange = useCallback((field: keyof SkillMetadata, value: unknown) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddTrigger = useCallback(() => {
    if (triggerInput.trim() && !metadata.triggers.includes(triggerInput.trim())) {
      handleMetadataChange('triggers', [...metadata.triggers, triggerInput.trim()]);
      setTriggerInput('');
    }
  }, [triggerInput, metadata.triggers, handleMetadataChange]);

  const handleRemoveTrigger = useCallback((trigger: string) => {
    handleMetadataChange('triggers', metadata.triggers.filter(t => t !== trigger));
  }, [metadata.triggers, handleMetadataChange]);

  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !metadata.tags.includes(tagInput.trim())) {
      handleMetadataChange('tags', [...metadata.tags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, metadata.tags, handleMetadataChange]);

  const handleRemoveTag = useCallback((tag: string) => {
    handleMetadataChange('tags', metadata.tags.filter(t => t !== tag));
  }, [metadata.tags, handleMetadataChange]);

  const handleRunTest = useCallback(async () => {
    if (!onTest) {return;}
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await onTest(definition);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  }, [definition, onTest]);

  const handleSave = useCallback(() => {
    onSave?.(metadata, definition);
  }, [metadata, definition, onSave]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Skill Builder</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={disabled || isTesting || !onTest}
            className={cn(
              "flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium",
              "bg-secondary text-secondary-foreground",
              "hover:bg-secondary/80",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Test</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            <Check className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b">
        {(['metadata', 'yaml', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium",
              "border-b-2 -mb-px transition-colors duration-150",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'metadata' && <Settings className="w-4 h-4" />}
            {tab === 'yaml' && <Code className="w-4 h-4" />}
            {tab === 'preview' && <FileText className="w-4 h-4" />}
            <span className="capitalize">{tab}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'metadata' && (
          <div className="flex flex-col gap-4 max-w-xl">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="skill-name" className="text-sm font-medium text-foreground">
                Skill Name <span className="text-destructive">*</span>
              </label>
              <input
                id="skill-name"
                type="text"
                value={metadata.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                placeholder="my-awesome-skill"
                disabled={disabled}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="skill-description" className="text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="skill-description"
                value={metadata.description}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                placeholder="What does this skill do?"
                rows={3}
                disabled={disabled}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "resize-none"
                )}
              />
            </div>

            {/* Triggers */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Triggers
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={triggerInput}
                  onChange={(e) => setTriggerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTrigger()}
                  placeholder="e.g., /my-command"
                  disabled={disabled}
                  className={cn(
                    "flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
                <button
                  type="button"
                  onClick={handleAddTrigger}
                  disabled={disabled || !triggerInput.trim()}
                  className={cn(
                    "h-10 px-4 rounded-md text-sm font-medium",
                    "bg-secondary text-secondary-foreground",
                    "hover:bg-secondary/80",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  Add
                </button>
              </div>
              {metadata.triggers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {metadata.triggers.map((trigger) => (
                    <span
                      key={trigger}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm",
                        "bg-secondary text-secondary-foreground"
                      )}
                    >
                      <ChevronRight className="w-3 h-3" />
                      {trigger}
                      <button
                        type="button"
                        onClick={() => handleRemoveTrigger(trigger)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Tags
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add a tag"
                  disabled={disabled}
                  className={cn(
                    "flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={disabled || !tagInput.trim()}
                  className={cn(
                    "h-10 px-4 rounded-md text-sm font-medium",
                    "bg-secondary text-secondary-foreground",
                    "hover:bg-secondary/80",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  Add
                </button>
              </div>
              {metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm",
                        "bg-accent text-accent-foreground"
                      )}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Version */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="skill-version" className="text-sm font-medium text-foreground">
                Version
              </label>
              <input
                id="skill-version"
                type="text"
                value={metadata.version}
                onChange={(e) => handleMetadataChange('version', e.target.value)}
                placeholder="1.0.0"
                disabled={disabled}
                className={cn(
                  "flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
            </div>
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="h-full">
            <textarea
              value={definition.yaml}
              onChange={(e) => setDefinition(prev => ({ ...prev, yaml: e.target.value }))}
              placeholder="Write your skill definition in YAML..."
              disabled={disabled}
              className={cn(
                "w-full h-full min-h-[400px] font-mono text-sm p-4 rounded-md",
                "border border-input bg-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "resize-none"
              )}
              spellCheck={false}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="flex flex-col gap-4">
            {/* Test Results */}
            {testResult && (
              <div
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border",
                  testResult.success
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                )}
              >
                {testResult.success ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div>
                  <p className={cn(
                    "font-medium",
                    testResult.success ? "text-green-500" : "text-red-500"
                  )}>
                    {testResult.success ? 'Test Passed' : 'Test Failed'}
                  </p>
                  <p className="text-sm text-muted-foreground">{testResult.message}</p>
                  {testResult.duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Duration: {testResult.duration}ms
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-foreground">Skill Preview</h3>
              <pre className="p-4 rounded-lg bg-muted/50 border overflow-auto text-xs font-mono">
                {JSON.stringify({ metadata, definition }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SkillBuilder;
