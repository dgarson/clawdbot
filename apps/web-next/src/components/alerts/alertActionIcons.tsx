import React from "react";
import { Bell, BookOpen, MessageSquare, Scale, Siren, Webhook } from "lucide-react";

export type SharedAlertActionType = "alert" | "pagerduty" | "slack" | "webhook" | "auto-scale" | "runbook";

export function AlertActionIcon({ type, className }: { type: SharedAlertActionType; className?: string }) {
  if (type === "alert") {return <Bell className={className} aria-hidden="true" />;}
  if (type === "pagerduty") {return <Siren className={className} aria-hidden="true" />;}
  if (type === "slack") {return <MessageSquare className={className} aria-hidden="true" />;}
  if (type === "webhook") {return <Webhook className={className} aria-hidden="true" />;}
  if (type === "auto-scale") {return <Scale className={className} aria-hidden="true" />;}
  return <BookOpen className={className} aria-hidden="true" />;
}

