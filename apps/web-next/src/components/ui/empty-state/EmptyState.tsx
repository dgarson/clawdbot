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
        description: 'Create your first agent to get started. Agents can help automate tasks and handle conversations.',
      };
    case 'no-sessions':
      return {
        icon: MessageSquare,
        title: 'No active sessions',
        description: 'Start a conversation with an agent to see sessions here. Sessions track your interactions over time.',
      };
    case 'no-skills':
      return {
        icon: Sparkles,
        title: 'No skills installed',
        description: 'Skills extend your agents with additional capabilities. Browse the marketplace to find skills.',
      };
    case 'no-results':
      return {
        icon: Search,
        title: 'No results found',
        description: 'Try adjusting your search or filters to find what you\'re looking for.',
      };
    case 'first-run':
      return {
        icon: Inbox,
        title: 'Welcome to OpenClaw',
        description: 'Get started by creating your first agent or exploring the skills marketplace.',
      };
    case 'generic':
    default:
      return {
        icon: FileQuestion,
        title: 'Nothing here yet',
        description: 'There\'s nothing to display. Take action to get started.',
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
