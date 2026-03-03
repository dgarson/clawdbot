import React from 'react';
import { cn } from '../../../lib/utils';
import { Eye, Copy, Check } from 'lucide-react';

interface LivePreviewProps {
  values: Record<string, unknown>;
  schema?: {
    title?: string;
    fields?: Array<{ key: string; label: string }>;
  };
  format?: 'json' | 'yaml';
  className?: string;
}

/**
 * LivePreview component - shows real-time form data
 */
export function LivePreview({
  values,
  schema,
  format = 'json',
  className,
}: LivePreviewProps) {
  const [copied, setCopied] = React.useState(false);

  const formattedData = React.useMemo(() => {
    if (format === 'yaml') {
      return toYaml(values);
    }
    return JSON.stringify(values, null, 2);
  }, [values, format]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Live Preview</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
            "hover:bg-muted transition-colors duration-150",
            "text-muted-foreground"
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <pre
          className={cn(
            "text-xs font-mono leading-relaxed",
            "whitespace-pre-wrap break-all"
          )}
        >
          {formattedData}
        </pre>
      </div>

      {/* Schema field labels summary (optional) */}
      {schema?.fields && (
        <div className="px-4 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
            {schema.title && ` • ${schema.title}`}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Simple JSON to YAML converter
 */
function toYaml(obj: unknown, indent: number = 0): string {
  if (obj === null || obj === undefined) {return 'null';}
  
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {return '[]';}
    return obj.map((item) => {
      const yaml = toYaml(item, indent + 2);
      if (typeof item === 'object' && item !== null) {
        return `${' '.repeat(indent)}- ${yaml.trimStart()}`;
      }
      return `${' '.repeat(indent)}- ${yaml}`;
    }).join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {return '{}';}
    
    return entries.map(([key, value]) => {
      const yaml = toYaml(value, indent + 2);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${' '.repeat(indent)}${key}:\n${yaml}`;
      }
      return `${' '.repeat(indent)}${key}: ${yaml}`;
    }).join('\n');
  }

  return typeof obj === 'string' ? obj : JSON.stringify(obj);
}

export default LivePreview;
