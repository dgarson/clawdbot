/**
 * Type declarations for @anthropic-ai/claude-agent-sdk
 *
 * The SDK ships with sdk.d.ts but TypeScript module resolution doesn't
 * find it when importing from the .mjs file directly. This declaration
 * re-exports types from the SDK's declaration file.
 */

declare module "@anthropic-ai/claude-agent-sdk/sdk.mjs" {
  export * from "@anthropic-ai/claude-agent-sdk";
}
