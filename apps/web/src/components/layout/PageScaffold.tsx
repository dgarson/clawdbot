"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/composed/ErrorState";
import {
  PageHeader,
  type BreadcrumbItem,
} from "./PageHeader";

export type PageScaffoldState = "ready" | "loading" | "empty" | "error";

export interface PageScaffoldProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  state?: PageScaffoldState;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  loadingFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export interface PageScaffoldSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export interface PageScaffoldLoadingProps {
  sections?: number;
  className?: string;
}

export interface PageScaffoldEmptyProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageScaffold({
  title,
  description,
  breadcrumbs,
  actions,
  state = "ready",
  children,
  className,
  contentClassName,
  loadingFallback,
  emptyFallback,
  errorFallback,
  emptyTitle = "No data yet",
  emptyDescription = "There is nothing to show right now.",
  emptyAction,
  errorTitle = "Something went wrong",
  errorDescription = "We couldn't load this page right now. Please try again.",
  onRetry,
  isRetrying = false,
}: PageScaffoldProps) {
  const content = React.useMemo(() => {
    if (state === "loading") {
      return loadingFallback ?? <PageScaffoldLoading />;
    }

    if (state === "error") {
      return (
        errorFallback ?? (
          <ErrorState
            variant="card"
            title={errorTitle}
            description={errorDescription}
            onRetry={onRetry}
            isRetrying={isRetrying}
          />
        )
      );
    }

    if (state === "empty") {
      return (
        emptyFallback ?? (
          <PageScaffoldEmpty
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        )
      );
    }

    return children;
  }, [
    state,
    loadingFallback,
    errorFallback,
    errorTitle,
    errorDescription,
    onRetry,
    isRetrying,
    emptyFallback,
    emptyTitle,
    emptyDescription,
    emptyAction,
    children,
  ]);

  return (
    <div className={cn("space-y-6", className)}>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />
      <div className={cn("space-y-6", contentClassName)}>
        {content}
      </div>
    </div>
  );
}

export function PageScaffoldSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageScaffoldSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="shrink-0">
            {actions}
          </div>
        )}
      </div>
      <div className={cn("", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export function PageScaffoldLoading({
  sections = 2,
  className,
}: PageScaffoldLoadingProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: sections }).map((_, index) => (
        <Card key={`scaffold-loading-${index}`}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[75%]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PageScaffoldEmpty({
  title = "No data yet",
  description = "There is nothing to show right now.",
  icon,
  action,
  className,
}: PageScaffoldEmptyProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
          {icon ?? <Inbox className="size-5 text-muted-foreground" />}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {description}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
