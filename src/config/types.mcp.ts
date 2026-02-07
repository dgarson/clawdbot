export type McpServerTransport = "stdio" | "sse" | "http";

/**
 * Readiness probe configuration for remote (HTTP/SSE) MCP servers.
 * When set, the gateway will retry connecting until the server successfully
 * responds to MCP `initialize` + `tools/list`, using exponential backoff.
 * This prevents race conditions when the MCP server is still starting up
 * (e.g. a launchd daemon that boots slower than the gateway).
 */
export type McpReadinessConfig = {
  /** Maximum number of connection retries. Default: 5. */
  retries?: number;
  /** Initial delay between retries in milliseconds. Default: 1000. */
  initialDelayMs?: number;
  /** Maximum delay between retries in milliseconds (backoff cap). Default: 10000. */
  maxDelayMs?: number;
  /** Total timeout budget in milliseconds before giving up. Default: 30000. */
  timeoutMs?: number;
};

export type McpServerConfigBase = {
  /** Enable/disable this MCP server entry. Default: true. */
  enabled?: boolean;
  /** Optional display label for UI/logging. */
  label?: string;
};

export type McpStdioServerConfig = McpServerConfigBase & {
  /** Default transport when omitted is "stdio" for parity with common MCP configs. */
  transport?: "stdio";
  /** Executable to spawn (absolute path or on PATH). */
  command: string;
  /** Command arguments. */
  args?: string[];
  /** Extra environment variables for the server process. */
  env?: Record<string, string>;
  /** Working directory for the server process. */
  cwd?: string;
  /** How to handle server stderr (Node child_process semantics). */
  stderr?: "inherit" | "pipe";
};

export type McpSseServerConfig = McpServerConfigBase & {
  transport: "sse";
  /** Base URL for the MCP SSE endpoint. */
  url: string;
  /** Optional headers for initial SSE and subsequent POST requests. */
  headers?: Record<string, string>;
  /**
   * Readiness probe for this SSE server. When configured, the gateway retries
   * connecting with exponential backoff until the server responds.
   * Set to `true` for defaults, or an object to customise retries/delays.
   */
  readiness?: boolean | McpReadinessConfig;
};

export type McpHttpServerConfig = McpServerConfigBase & {
  transport: "http";
  /** Base URL for the MCP Streamable HTTP endpoint. */
  url: string;
  /** Optional headers for HTTP requests. */
  headers?: Record<string, string>;
  /**
   * Readiness probe for this HTTP server. When configured, the gateway retries
   * connecting with exponential backoff until the server responds.
   * Set to `true` for defaults, or an object to customise retries/delays.
   * Default: `true` – HTTP MCP servers always get readiness probing.
   */
  readiness?: boolean | McpReadinessConfig;
};

export type McpServerConfig = McpStdioServerConfig | McpSseServerConfig | McpHttpServerConfig;

export type McpServersConfig = Record<string, McpServerConfig>;
