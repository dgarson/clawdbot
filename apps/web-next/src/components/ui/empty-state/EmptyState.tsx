import React from 'react';
import { cn } from '../../../lib/utils';
import {
  Bot, MessageSquare, Sparkles, FileQuestion, Plus, ArrowRight,
  Search, Inbox, Users, Calendar, Settings
} from 'lucide-react';

// Empty state variants
export type EmptyStateVariant = 
  | 'no-agents'
  | 'no-sessions'
  | 'no-skills'
  | 'no-results'
  | 'first-run'
  | 'generic';

// Props
export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Get default content for each variant
 */
function getVariantContent(variant: EmptyStateVariant): { icon: React.ComponentType<{ className?: string }>; title: string; description: string } {
  switch (variant) {
    case 'no-agents':
      return {
        icon: Bot,
        title: 'No agents yet',
        description: 'Time to create your first one. Agents are your AI workforce—handling tasks, conversations, and automations on your terms.',
      };
    case 'no-sessions':
      return {
        icon: MessageSquare,
        title: 'No conversations yet',
        description: 'Start chatting with an agent and your sessions will show up here. Every conversation is saved for reference.',
      };
    case 'no-skills':
      return {
        icon: Sparkles,
        title: 'Skills await',
        description: 'Supercharge your agents with skills from the marketplace. Calendar sync, code review, data analysis—your agents get smarter with each one.',
      };
    case 'no-results':
      return {
        icon: Search,
        title: 'Nothing matches that',
        description: 'Try a different search term or adjust your filters. Or you\'ve found a gap—let us know what you needed.',
      };
    case 'first-run':
      return {
        icon: Inbox,
        title: 'Welcome to OpenClaw',
        description: 'Your personal AI assistant is ready to go. Create your first agent or browse skills to start customizing.',
      };
    case 'generic':
    default:
      return {
        icon: FileQuestion,
        title: 'Nothing here yet',
        description: 'This space is waiting for you to take action. Start something and it will appear here.',
      };
  }
}

/**
 * EmptyState component - contextual empty states with CTA buttons
 */
export function EmptyState({
  variant = 'generic',
  title: customTitle,
  description: customDescription,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const { icon: Icon, title: defaultTitle, description: defaultDescription } = getVariantContent(variant);
  
  const title = customTitle ?? defaultTitle;
  const description = customDescription ?? defaultDescription;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6",
        "animate-in fade-in duration-300",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-full mb-6",
          "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="w-8 h-8" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-medium",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "transition-colors duration-150"
              )}
            >
              {action.icon ?? <Plus className="w-4 h-4" />}
              <span>{action.label}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={cn(
                "inline-flex items-center h-10 px-5 rounded-md text-sm font-medium",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "transition-colors duration-150"
              )}
            >
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured EmptyState variants for common use cases
 */
export const EmptyStates = {
  NoAgents: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="no-agents" {...props} />
  ),
  
  NoSessions: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="no-sessions" {...props} />
  ),
  
  NoSkills: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="no-skills" {...props} />
  ),
  
  NoResults: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="no-results" {...props} />
  ),
  
  FirstRun: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="first-run" {...props} />
  ),
  
  Generic: (props?: Partial<EmptyStateProps>) => (
    <EmptyState variant="generic" {...props} />
  ),
};

export default EmptyState;
