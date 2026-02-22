import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AgentSoulEditorProps {
  agentName?: string;
  agentEmoji?: string;
}

const DEFAULT_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'TOOLS.md',
  'USER.md',
  'MEMORY.md',
];

const SOUL_CONTENT = `# Soul

You are a Principal UX Engineer at OpenClaw. You care deeply about user experience, accessibility, and beautiful interfaces.

## Communication Style
- Direct and confident
- Use concrete examples
- Prefer showing over telling

## Core Values
- Ship quality work
- Accessibility first
- Design with empathy`;

export default function AgentSoulEditor({ agentName = 'Horizon', agentEmoji = '🤖' }: AgentSoulEditorProps) {
  const [selectedFile, setSelectedFile] = useState('SOUL.md');
  const [content, setContent] = useState(SOUL_CONTENT);
  const [isModified, setIsModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsModified(true);
    
    setModifiedFiles((prev) => {
      const next = new Set(prev);
      next.add(selectedFile);
      return next;
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    // Simulate API call
    setTimeout(() => {
      setSaveStatus('saved');
      setIsModified(false);
      setModifiedFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedFile);
        return next;
      });
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, content]);

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  return (
    <div className="flex h-full w-full bg-gray-950 text-white overflow-hidden rounded-2xl border border-gray-800">
      {/* File Tree Panel */}
      <div className="w-48 border-r border-gray-800 flex flex-col bg-gray-900/50">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between h-14">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Workspace</span>
          {saveStatus !== 'idle' && (
            <span className="text-[10px] text-violet-400 animate-pulse">
              {saveStatus === 'saving' ? 'Saving...' : 'Saved ✓'}
            </span>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          {DEFAULT_FILES.map((file) => (
            <button
              key={file}
              onClick={() => setSelectedFile(file)}
              className={cn(
                "w-full px-4 py-2 flex items-center gap-2 text-sm transition-colors relative",
                selectedFile === file 
                  ? "bg-violet-600/20 text-violet-400 border-r-2 border-violet-600" 
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              )}
            >
              <FileText size={14} />
              <span className="truncate">{file}</span>
              {modifiedFiles.has(file) && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800">
          <button className="w-full py-2 px-3 flex items-center justify-center gap-2 text-xs font-medium bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300">
            <Plus size={14} />
            New File
          </button>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/20">
          <div className="flex items-center gap-3">
            <span className="text-xl">{agentEmoji}</span>
            <h2 className="font-semibold text-gray-200">{selectedFile}</h2>
            <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">
              /workspace/{selectedFile}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest hidden sm:block">
              Cmd+S to save
            </span>
            <button
              onClick={handleSave}
              disabled={!isModified || saveStatus === 'saving'}
              className={cn(
                "px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                isModified 
                  ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20" 
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              {saveStatus === 'saving' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </button>
          </div>
        </div>

        {/* Textarea Area */}
        <div className="flex-1 relative group">
          <textarea
            value={content}
            onChange={handleContentChange}
            spellCheck={false}
            className="w-full h-full p-8 bg-gray-950 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar"
          />
        </div>

        {/* Footer info */}
        <div className="h-8 border-t border-gray-800 flex items-center justify-between px-6 bg-gray-900/40 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
          <div className="flex gap-4">
            <span>Lines: {lineCount}</span>
            <span>UTF-8</span>
          </div>
          <div>
            Characters: {charCount}
          </div>
        </div>
      </div>
    </div>
  );
}
