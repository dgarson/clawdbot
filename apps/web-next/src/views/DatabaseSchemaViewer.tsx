import React, { useState } from "react";
import { cn } from "../lib/utils";

// ============================================================================
// Types
// ============================================================================

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isIndexed: boolean;
  isUnique: boolean;
  references?: {
    table: string;
    column: string;
  };
}

interface Table {
  name: string;
  rowCount: number;
  sizeKB: number;
  columns: Column[];
}

interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: "1:1" | "1:N" | "N:1" | "N:M";
}

interface Migration {
  version: string;
  name: string;
  appliedAt: string | null;
  executionTime: number;
  status: "applied" | "pending" | "rolled_back";
}

interface SearchResult {
  tableName: string;
  columnName: string;
  matchType: "table" | "column" | "type";
}

// ============================================================================
// Sample Data
// ============================================================================

const sampleTables: Table[] = [
  {
    name: "users",
    rowCount: 12453,
    sizeKB: 2048,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "email", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "password_hash", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "first_name", type: "varchar(100)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "last_name", type: "varchar(100)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "avatar_url", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "phone", type: "varchar(20)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "is_active", type: "boolean", nullable: false, default: "true", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "email_verified", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "organization_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "organizations", column: "id" } },
      { name: "role", type: "enum('admin','member','viewer')", nullable: false, default: "'member'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "last_login_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "deleted_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "organizations",
    rowCount: 482,
    sizeKB: 384,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "name", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "slug", type: "varchar(100)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "logo_url", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "website", type: "varchar(500)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "billing_email", type: "varchar(255)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "subscription_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "subscriptions", column: "id" } },
      { name: "plan_tier", type: "enum('free','starter','professional','enterprise')", nullable: false, default: "'free'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "max_users", type: "integer", nullable: false, default: "5", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "storage_quota_gb", type: "integer", nullable: false, default: "5", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "is_active", type: "boolean", nullable: false, default: "true", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "trial_ends_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "deleted_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "subscriptions",
    rowCount: 412,
    sizeKB: 256,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "organization_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: true, references: { table: "organizations", column: "id" } },
      { name: "stripe_subscription_id", type: "varchar(255)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "stripe_customer_id", type: "varchar(255)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "plan", type: "enum('free','starter','professional','enterprise')", nullable: false, default: "'free'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "status", type: "enum('active','canceled','past_due','trialing')", nullable: false, default: "'trialing'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "current_period_start", type: "timestamp", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "current_period_end", type: "timestamp", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "cancel_at_period_end", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "projects",
    rowCount: 3891,
    sizeKB: 1536,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "name", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "description", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "organization_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "organizations", column: "id" } },
      { name: "owner_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "status", type: "enum('active','archived','deleted')", nullable: false, default: "'active'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "visibility", type: "enum('private','internal','public')", nullable: false, default: "'private'", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "settings", type: "jsonb", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "tags", type: "text[]", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "default_role", type: "varchar(50)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "is_template", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "deleted_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "archived_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "documents",
    rowCount: 28734,
    sizeKB: 8192,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "title", type: "varchar(500)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "content", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "project_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "projects", column: "id" } },
      { name: "owner_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "folder_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "folders", column: "id" } },
      { name: "file_type", type: "varchar(50)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "file_size", type: "bigint", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "mime_type", type: "varchar(100)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "storage_path", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: true },
      { name: "version", type: "integer", nullable: false, default: "1", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "is_locked", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "locked_by", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "folders",
    rowCount: 1247,
    sizeKB: 512,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "name", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "project_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "projects", column: "id" } },
      { name: "parent_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "folders", column: "id" } },
      { name: "path", type: "text", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "depth", type: "integer", nullable: false, default: "0", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "color", type: "varchar(7)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "icon", type: "varchar(50)", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "sort_order", type: "integer", nullable: false, default: "0", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "is_archived", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "comments",
    rowCount: 8934,
    sizeKB: 1024,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "content", type: "text", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "document_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "documents", column: "id" } },
      { name: "author_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "parent_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "comments", column: "id" } },
      { name: "is_resolved", type: "boolean", nullable: false, default: "false", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "resolved_by", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "resolved_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "mentions", type: "uuid[]", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "deleted_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
  {
    name: "audit_logs",
    rowCount: 156789,
    sizeKB: 12288,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "user_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "organization_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "organizations", column: "id" } },
      { name: "action", type: "varchar(100)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "resource_type", type: "varchar(50)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "resource_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "details", type: "jsonb", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "ip_address", type: "inet", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "user_agent", type: "text", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "session_id", type: "uuid", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
    ],
  },
  {
    name: "api_keys",
    rowCount: 2156,
    sizeKB: 384,
    columns: [
      { name: "id", type: "uuid", nullable: false, default: null, isPrimaryKey: true, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "name", type: "varchar(100)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "key_hash", type: "varchar(255)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: true },
      { name: "key_prefix", type: "varchar(20)", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "user_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "users", column: "id" } },
      { name: "organization_id", type: "uuid", nullable: false, default: null, isPrimaryKey: false, isForeignKey: true, isIndexed: true, isUnique: false, references: { table: "organizations", column: "id" } },
      { name: "scopes", type: "text[]", nullable: false, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "last_used_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "expires_at", type: "timestamp", nullable: true, default: null, isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "is_active", type: "boolean", nullable: false, default: "true", isPrimaryKey: false, isForeignKey: false, isIndexed: true, isUnique: false },
      { name: "created_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
      { name: "updated_at", type: "timestamp", nullable: false, default: "CURRENT_TIMESTAMP", isPrimaryKey: false, isForeignKey: false, isIndexed: false, isUnique: false },
    ],
  },
];

const sampleRelationships: Relationship[] = [
  { fromTable: "users", fromColumn: "organization_id", toTable: "organizations", toColumn: "id", cardinality: "N:1" },
  { fromTable: "organizations", fromColumn: "subscription_id", toTable: "subscriptions", toColumn: "id", cardinality: "1:1" },
  { fromTable: "subscriptions", fromColumn: "organization_id", toTable: "organizations", toColumn: "id", cardinality: "1:1" },
  { fromTable: "projects", fromColumn: "organization_id", toTable: "organizations", toColumn: "id", cardinality: "N:1" },
  { fromTable: "projects", fromColumn: "owner_id", toTable: "users", toColumn: "id", cardinality: "N:1" },
  { fromTable: "documents", fromColumn: "project_id", toTable: "projects", toColumn: "id", cardinality: "N:1" },
  { fromTable: "documents", fromColumn: "owner_id", toTable: "users", toColumn: "id", cardinality: "N:1" },
  { fromTable: "documents", fromColumn: "folder_id", toTable: "folders", toColumn: "id", cardinality: "N:1" },
  { fromTable: "folders", fromColumn: "project_id", toTable: "projects", toColumn: "id", cardinality: "N:1" },
  { fromTable: "folders", fromColumn: "parent_id", toTable: "folders", toColumn: "id", cardinality: "N:1" },
  { fromTable: "comments", fromColumn: "document_id", toTable: "documents", toColumn: "id", cardinality: "N:1" },
  { fromTable: "comments", fromColumn: "author_id", toTable: "users", toColumn: "id", cardinality: "N:1" },
  { fromTable: "comments", fromColumn: "parent_id", toTable: "comments", toColumn: "id", cardinality: "N:1" },
  { fromTable: "audit_logs", fromColumn: "user_id", toTable: "users", toColumn: "id", cardinality: "N:1" },
  { fromTable: "audit_logs", fromColumn: "organization_id", toTable: "organizations", toColumn: "id", cardinality: "N:1" },
  { fromTable: "api_keys", fromColumn: "user_id", toTable: "users", toColumn: "id", cardinality: "N:1" },
  { fromTable: "api_keys", fromColumn: "organization_id", toTable: "organizations", toColumn: "id", cardinality: "N:1" },
];

const sampleMigrations: Migration[] = [
  { version: "20240101000001", name: "create_users_table", appliedAt: "2024-01-15 10:23:45", executionTime: 145, status: "applied" },
  { version: "20240101000002", name: "create_organizations_table", appliedAt: "2024-01-15 10:23:47", executionTime: 89, status: "applied" },
  { version: "20240101000003", name: "add_organization_id_to_users", appliedAt: "2024-01-15 10:23:49", executionTime: 67, status: "applied" },
  { version: "20240101000004", name: "create_subscriptions_table", appliedAt: "2024-01-18 14:12:33", executionTime: 112, status: "applied" },
  { version: "20240101000005", name: "create_projects_table", appliedAt: "2024-01-22 09:45:21", executionTime: 198, status: "applied" },
  { version: "20240101000006", name: "create_documents_table", appliedAt: "2024-01-25 16:33:08", executionTime: 234, status: "applied" },
  { version: "20240101000007", name: "create_folders_table", appliedAt: "2024-01-28 11:20:55", executionTime: 156, status: "applied" },
  { version: "20240101000008", name: "create_comments_table", appliedAt: "2024-02-01 08:15:42", executionTime: 178, status: "applied" },
  { version: "20240101000009", name: "add_folder_path_index", appliedAt: "2024-02-05 13:44:19", executionTime: 45, status: "applied" },
  { version: "20240101000010", name: "create_audit_logs_table", appliedAt: "2024-02-10 10:30:00", executionTime: 289, status: "applied" },
  { version: "20240101000011", name: "create_api_keys_table", appliedAt: "2024-02-15 15:22:11", executionTime: 134, status: "applied" },
  { version: "20240101000012", name: "add_user_last_login_index", appliedAt: "2024-02-18 09:10:33", executionTime: 56, status: "applied" },
  { version: "20240101000013", name: "add_document_versioning", appliedAt: "2024-02-20 14:55:48", executionTime: 201, status: "applied" },
  { version: "20240101000014", name: "add_comment_resolve_feature", appliedAt: "2024-02-22 11:30:15", executionTime: 123, status: "applied" },
  { version: "20240101000015", name: "create_user_sessions_table", appliedAt: null, executionTime: 0, status: "pending" },
  { version: "20240101000016", name: "add_oauth_providers", appliedAt: null, executionTime: 0, status: "pending" },
  { version: "20240101000017", name: "create_webhooks_table", appliedAt: null, executionTime: 0, status: "pending" },
];

const sampleRollbackLog = [
  { version: "20231215000003", name: "remove_deprecated_api_columns", rolledBackAt: "2024-01-02 08:30:00", reason: "Deprecated API cleanup" },
  { version: "20231210000001", name: "drop_old_notifications_table", rolledBackAt: "2023-12-28 16:45:00", reason: "Replaced with new notification system" },
  { version: "20231120000005", name: "rename_user_settings_column", rolledBackAt: "2023-12-15 11:20:00", reason: "Naming convention change" },
];

// Sample data for preview
const sampleDataByTable: Record<string, Record<string, string>[]> = {
  users: [
    { id: "a1b2c3d4-...", email: "john@example.com", first_name: "John", last_name: "Doe", role: "admin", is_active: "true" },
    { id: "e5f6g7h8-...", email: "jane@example.com", first_name: "Jane", last_name: "Smith", role: "member", is_active: "true" },
    { id: "i9j0k1l2-...", email: "bob@example.com", first_name: "Bob", last_name: "Wilson", role: "viewer", is_active: "false" },
  ],
  organizations: [
    { id: "org-001-...", name: "Acme Corp", slug: "acme-corp", plan_tier: "enterprise", is_active: "true" },
    { id: "org-002-...", name: "TechStart Inc", slug: "techstart", plan_tier: "professional", is_active: "true" },
    { id: "org-003-...", name: "SmallBiz LLC", slug: "smallbiz", plan_tier: "starter", is_active: "true" },
  ],
  projects: [
    { id: "proj-001-...", name: "Website Redesign", status: "active", visibility: "internal", is_template: "false" },
    { id: "proj-002-...", name: "Mobile App", status: "active", visibility: "private", is_template: "false" },
    { id: "proj-003-...", name: "Marketing Templates", status: "active", visibility: "public", is_template: "true" },
  ],
};

// ============================================================================
// Helper Components
// ============================================================================

const Badge: React.FC<{
  variant: "primary" | "success" | "warning" | "error" | "info";
  children: React.ReactNode;
}> = ({ variant, children }) => {
  const variantStyles = {
    primary: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    success: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
    warning: "bg-amber-400/20 text-amber-400 border-amber-400/30",
    error: "bg-rose-400/20 text-rose-400 border-rose-400/30",
    info: "bg-[var(--color-surface-3)]/50 text-[var(--color-text-primary)] border-[var(--color-surface-3)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded border",
        variantStyles[variant]
      )}
    >
      {children}
    </span>
  );
};

// ============================================================================
// Tables Tab Component
// ============================================================================

const TablesTab: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<string>(sampleTables[0].name);

  const table = sampleTables.find((t) => t.name === selectedTable)!;

  const getPrimaryKeys = (t: Table) => t.columns.filter((c) => c.isPrimaryKey);
  const getForeignKeys = (t: Table) => t.columns.filter((c) => c.isForeignKey);
  const getUniqueConstraints = (t: Table) => t.columns.filter((c) => c.isUnique);
  const getCheckConstraints = (t: Table) => t.columns.filter((c) => c.type.startsWith("enum"));

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Table List */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)]">
        <div className="p-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Tables</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sampleTables.length} tables</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sampleTables.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelectedTable(t.name)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-150",
                selectedTable === t.name
                  ? "bg-indigo-600 text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs opacity-70">{t.rowCount.toLocaleString()} rows</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel - Table Details */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)]">
          {/* Table Header */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{table.name}</h2>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-secondary)] text-sm">Rows:</span>
                <span className="text-[var(--color-text-primary)] font-medium">{table.rowCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-secondary)] text-sm">Size:</span>
                <span className="text-[var(--color-text-primary)] font-medium">{table.sizeKB} KB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-secondary)] text-sm">Columns:</span>
                <span className="text-[var(--color-text-primary)] font-medium">{table.columns.length}</span>
              </div>
            </div>
          </div>

          {/* Columns Table */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Columns</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Type</th>
                    <th className="text-center py-2 px-3 text-[var(--color-text-secondary)] font-medium">Nullable</th>
                    <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Default</th>
                    <th className="text-center py-2 px-3 text-[var(--color-text-secondary)] font-medium">Attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col) => (
                    <tr key={col.name} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30">
                      <td className="py-2 px-3 text-[var(--color-text-primary)] font-mono text-xs">{col.name}</td>
                      <td className="py-2 px-3 text-[var(--color-text-secondary)] font-mono text-xs">{col.type}</td>
                      <td className="py-2 px-3 text-center">
                        {col.nullable ? (
                          <span className="text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-rose-400">No</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[var(--color-text-muted)] font-mono text-xs">
                        {col.default || "-"}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {col.isPrimaryKey && <Badge variant="primary">PK</Badge>}
                          {col.isForeignKey && <Badge variant="info">FK</Badge>}
                          {col.isIndexed && <Badge variant="warning">Idx</Badge>}
                          {col.isUnique && <Badge variant="success">UQ</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Constraints */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Constraints</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Primary Keys */}
              <div className="bg-[var(--color-surface-0)]/50 rounded p-3">
                <h4 className="text-xs font-medium text-indigo-400 mb-2">Primary Keys</h4>
                <div className="flex flex-wrap gap-1">
                  {getPrimaryKeys(table).map((col) => (
                    <span key={col.name} className="text-xs text-[var(--color-text-primary)] font-mono">
                      {col.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Foreign Keys */}
              <div className="bg-[var(--color-surface-0)]/50 rounded p-3">
                <h4 className="text-xs font-medium text-amber-400 mb-2">Foreign Keys</h4>
                <div className="space-y-1">
                  {getForeignKeys(table).map((col) => (
                    <div key={col.name} className="text-xs">
                      <span className="text-[var(--color-text-primary)] font-mono">{col.name}</span>
                      <span className="text-[var(--color-text-muted)]"> → </span>
                      <span className="text-[var(--color-text-secondary)] font-mono">
                        {col.references?.table}.{col.references?.column}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unique Constraints */}
              <div className="bg-[var(--color-surface-0)]/50 rounded p-3">
                <h4 className="text-xs font-medium text-emerald-400 mb-2">Unique Constraints</h4>
                <div className="flex flex-wrap gap-1">
                  {getUniqueConstraints(table).map((col) => (
                    <span key={col.name} className="text-xs text-[var(--color-text-primary)] font-mono">
                      {col.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Check Constraints */}
              <div className="bg-[var(--color-surface-0)]/50 rounded p-3">
                <h4 className="text-xs font-medium text-rose-400 mb-2">Check Constraints</h4>
                <div className="space-y-1">
                  {getCheckConstraints(table).map((col) => (
                    <div key={col.name} className="text-xs">
                      <span className="text-[var(--color-text-primary)] font-mono">{col.name}</span>
                      <span className="text-[var(--color-text-muted)]"> ∈ </span>
                      <span className="text-[var(--color-text-secondary)]">{col.type.replace(/^enum\('(.+)'\)$/, "$1").split("','").join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sample Data Preview */}
          {sampleDataByTable[table.name] && (
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Sample Data (First 3 Rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {Object.keys(sampleDataByTable[table.name][0]).map((key) => (
                        <th key={key} className="text-left py-2 px-2 text-[var(--color-text-secondary)] font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleDataByTable[table.name].map((row, idx) => (
                      <tr key={idx} className="border-b border-[var(--color-border)]/50">
                        {Object.entries(row).map(([key, value]) => (
                          <td key={key} className="py-2 px-2 text-[var(--color-text-primary)] font-mono">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Relationships Tab Component
// ============================================================================

const RelationshipsTab: React.FC = () => {
  // Calculate positions for tables in a grid layout
  const getTablePosition = (index: number, total: number) => {
    const cols = 3;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      left: `${10 + col * 30}%`,
      top: `${10 + row * 35}%`,
    };
  };

  const getLineStyle = (rel: Relationship): React.CSSProperties => {
    const fromIdx = sampleTables.findIndex((t) => t.name === rel.fromTable);
    const toIdx = sampleTables.findIndex((t) => t.name === rel.toTable);
    const fromPos = getTablePosition(fromIdx, sampleTables.length);
    const toPos = getTablePosition(toIdx, sampleTables.length);

    const x1 = parseFloat(fromPos.left) + 15;
    const y1 = parseFloat(fromPos.top) + 10;
    const x2 = parseFloat(toPos.left) + 15;
    const y2 = parseFloat(toPos.top) + 10;

    // Determine which side of the boxes to connect
    let startX = x1 + (x2 > x1 ? 20 : -5);
    let startY = y1 + 10;
    let endX = x2 + (x2 > x1 ? -5 : 20);
    let endY = y2 + 10;

    // Add curve points for smoother lines
    const midX = (startX + endX) / 2;

    return {
      position: "absolute" as const,
      left: `${Math.min(startX, endX)}%`,
      top: `${Math.min(startY, endY)}%`,
      width: `${Math.abs(endX - startX) + 10}%`,
      height: `${Math.abs(endY - startY) + 20}%`,
      borderLeft: "2px solid",
      borderLeftColor: rel.cardinality === "1:N" || rel.cardinality === "N:1" ? "rgba(99, 102, 241, 0.6)" : "rgba(234, 179, 8, 0.6)",
      borderRight: "2px solid",
      borderRightColor: rel.cardinality === "1:N" || rel.cardinality === "N:1" ? "rgba(99, 102, 241, 0.6)" : "rgba(234, 179, 8, 0.6)",
      borderTop: "2px solid transparent",
      borderBottom: "2px solid transparent",
      pointerEvents: "none" as const,
    };
  };

  return (
    <div className="h-full relative bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Entity Relationship Diagram</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {sampleRelationships.length} relationships • {sampleTables.length} tables
        </p>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-[var(--color-surface-0)]/80 rounded p-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <div className="w-3 h-0.5 bg-indigo-500/60"></div>
          <span>One-to-Many</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mt-1">
          <div className="w-3 h-0.5 bg-yellow-500/60"></div>
          <span>One-to-One</span>
        </div>
      </div>

      {/* Diagram Container */}
      <div className="relative w-full h-full p-8">
        {/* Relationship Lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <marker
              id="arrowhead-n"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="rgba(99, 102, 241, 0.8)" />
            </marker>
            <marker
              id="arrowhead-1"
              markerWidth="10"
              markerHeight="7"
              refX="0"
              refY="3.5"
              orient="auto"
            >
              <polygon points="10 0, 0 3.5, 10 7" fill="rgba(99, 102, 241, 0.8)" />
            </marker>
          </defs>
          {sampleRelationships.map((rel, idx) => {
            const fromIdx = sampleTables.findIndex((t) => t.name === rel.fromTable);
            const toIdx = sampleTables.findIndex((t) => t.name === rel.toTable);
            const fromPos = getTablePosition(fromIdx, sampleTables.length);
            const toPos = getTablePosition(toIdx, sampleTables.length);

            const x1 = parseFloat(fromPos.left) + 15;
            const y1 = parseFloat(fromPos.top) + 15;
            const x2 = parseFloat(toPos.left) + 15;
            const y2 = parseFloat(toPos.top) + 15;

            const isCurved = fromIdx !== toIdx;
            const midY = (y1 + y2) / 2;

            return (
              <g key={idx}>
                <path
                  d={
                    isCurved
                      ? `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
                      : `M ${x1} ${y1} L ${x2} ${y2}`
                  }
                  fill="none"
                  stroke={rel.cardinality === "1:1" ? "rgba(234, 179, 8, 0.5)" : "rgba(99, 102, 241, 0.5)"}
                  strokeWidth="2"
                  markerEnd={rel.cardinality === "1:N" ? "url(#arrowhead-n)" : ""}
                  markerStart={rel.cardinality === "N:1" ? "url(#arrowhead-1)" : ""}
                />
              </g>
            );
          })}
        </svg>

        {/* Table Boxes */}
        {sampleTables.map((table, idx) => {
          const pos = getTablePosition(idx, sampleTables.length);
          const relatedTables = sampleRelationships
            .filter((r) => r.fromTable === table.name || r.toTable === table.name)
            .map((r) => (r.fromTable === table.name ? r.toTable : r.fromTable));

          return (
            <div
              key={table.name}
              className="absolute bg-[var(--color-surface-0)] border-2 border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden"
              style={{
                left: pos.left,
                top: pos.top,
                width: "25%",
                minWidth: "180px",
              }}
            >
              {/* Table Header */}
              <div className="bg-[var(--color-surface-2)] px-3 py-2 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{table.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{table.rowCount}</span>
                </div>
              </div>

              {/* Columns */}
              <div className="p-2">
                {table.columns.slice(0, 5).map((col) => (
                  <div key={col.name} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1">
                      {col.isPrimaryKey && <span className="text-indigo-400 text-xs">🔑</span>}
                      {col.isForeignKey && !col.isPrimaryKey && <span className="text-amber-400 text-xs">→</span>}
                      <span className="text-xs text-[var(--color-text-primary)] font-mono truncate max-w-24">
                        {col.name}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{col.type.split("(")[0]}</span>
                  </div>
                ))}
                {table.columns.length > 5 && (
                  <div className="text-xs text-[var(--color-text-muted)] py-0.5">+{table.columns.length - 5} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Migrations Tab Component
// ============================================================================

const MigrationsTab: React.FC = () => {
  const appliedMigrations = sampleMigrations.filter((m) => m.status === "applied");
  const pendingMigrations = sampleMigrations.filter((m) => m.status === "pending");

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Applied Migrations */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)]">
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Applied Migrations</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{appliedMigrations.length} migrations applied</p>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {appliedMigrations.map((migration, idx) => (
              <div
                key={migration.version}
                className={cn(
                  "p-3 rounded-md mb-2",
                  idx % 2 === 0 ? "bg-[var(--color-surface-0)]/50" : "bg-[var(--color-surface-0)]/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono">{migration.version}</div>
                    <div className="text-sm text-[var(--color-text-primary)] font-medium mt-1">{migration.name}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="success">Applied</Badge>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{migration.executionTime}ms</div>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-2">{migration.appliedAt ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Migrations */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)]">
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">⏳</span>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Pending Migrations</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{pendingMigrations.length} migrations pending</p>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {pendingMigrations.map((migration, idx) => (
              <div
                key={migration.version}
                className={cn(
                  "p-3 rounded-md mb-2",
                  idx % 2 === 0 ? "bg-[var(--color-surface-0)]/50" : "bg-[var(--color-surface-0)]/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono">{migration.version}</div>
                    <div className="text-sm text-[var(--color-text-primary)] font-medium mt-1">{migration.name}</div>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rollback Log */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] lg:col-span-2">
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <span className="text-rose-400">↩</span>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Rollback Log</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sampleRollbackLog.length} rollbacks recorded</p>
          </div>
          <div className="p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Version</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Rolled Back At</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {sampleRollbackLog.map((rollback) => (
                  <tr key={rollback.version} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30">
                    <td className="py-2 px-3 text-[var(--color-text-muted)] font-mono text-xs">{rollback.version}</td>
                    <td className="py-2 px-3 text-[var(--color-text-primary)] font-medium">{rollback.name}</td>
                    <td className="py-2 px-3 text-[var(--color-text-secondary)] text-xs">{rollback.rolledBackAt}</td>
                    <td className="py-2 px-3 text-[var(--color-text-secondary)] text-xs">{rollback.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Search Tab Component
// ============================================================================

const SearchTab: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setHasSearched(true);

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const searchResults: SearchResult[] = [];
    const lowerQuery = searchQuery.toLowerCase();

    sampleTables.forEach((table) => {
      // Match table name
      if (table.name.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          tableName: table.name,
          columnName: table.name,
          matchType: "table",
        });
      }

      // Match columns
      table.columns.forEach((col) => {
        if (col.name.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            tableName: table.name,
            columnName: col.name,
            matchType: "column",
          });
        }
        if (col.type.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            tableName: table.name,
            columnName: col.name,
            matchType: "type",
          });
        }
      });
    });

    setResults(searchResults);
  };

  // Group results by table
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.tableName]) {
      acc[result.tableName] = [];
    }
    acc[result.tableName].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search tables, columns, or types..."
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Search across {sampleTables.length} tables, {sampleTables.reduce((a, t) => a + t.columns.length, 0)} columns
        </p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          <div className="text-center py-12">
            <div className="text-[var(--color-text-muted)] text-4xl mb-4">🔍</div>
            <p className="text-[var(--color-text-secondary)]">Enter a search term to find tables and columns</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--color-text-muted)] text-4xl mb-4">📭</div>
            <p className="text-[var(--color-text-secondary)]">No results found for "{query}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Found {results.length} result{results.length !== 1 ? "s" : ""} in {Object.keys(groupedResults).length} table{Object.keys(groupedResults).length !== 1 ? "s" : ""}
            </p>
            {Object.entries(groupedResults).map(([tableName, cols]) => (
              <div key={tableName} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
                <div className="p-3 bg-[var(--color-surface-2)]/50 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{tableName}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{cols.length} match{cols.length !== 1 ? "es" : ""}</span>
                  </div>
                </div>
                <div className="p-2">
                  {cols.map((result, idx) => (
                    <div
                      key={`${result.tableName}-${result.columnName}-${idx}`}
                      className="flex items-center justify-between py-2 px-3 hover:bg-[var(--color-surface-2)]/30 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--color-text-muted)] font-mono">{result.columnName}</span>
                        {result.matchType === "table" && <Badge variant="primary">Table</Badge>}
                        {result.matchType === "column" && <Badge variant="info">Column</Badge>}
                        {result.matchType === "type" && <Badge variant="warning">Type</Badge>}
                      </div>
                      {result.matchType !== "table" && (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {sampleTables
                            .find((t) => t.name === result.tableName)
                            ?.columns.find((c) => c.name === result.columnName)?.type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

type TabType = "tables" | "relationships" | "migrations" | "search";

const DatabaseSchemaViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("tables");

  const tabs: { id: TabType; label: string }[] = [
    { id: "tables", label: "Tables" },
    { id: "relationships", label: "Relationships" },
    { id: "migrations", label: "Migrations" },
    { id: "search", label: "Search" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Database Schema Viewer</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Explore your database structure, relationships, and migrations</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-[var(--color-border)]">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-all duration-150",
                activeTab === tab.id
                  ? "text-indigo-400 border-indigo-500"
                  : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="h-[calc(100vh-220px)]">
        {activeTab === "tables" && <TablesTab />}
        {activeTab === "relationships" && <RelationshipsTab />}
        {activeTab === "migrations" && <MigrationsTab />}
        {activeTab === "search" && <SearchTab />}
      </div>
    </div>
  );
};

export default DatabaseSchemaViewer;
