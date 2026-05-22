import type { LocalMcpConfig } from "./types"

/**
 * LSP tools MCP — language server diagnostics, goto-def, references, symbols.
 * Local stdio MCP backed by the lsp-tools-mcp package.
 *
 * TODO: Set up lsp-tools-mcp as a git submodule or npm dependency.
 * For now this is a placeholder that returns null — LSP MCP won't be available
 * until the lsp-tools-mcp package is configured.
 */
export function createLspMcpConfig(): LocalMcpConfig | null {
  // Placeholder: returns null until lsp-tools-mcp is set up
  // When ready, use either:
  // - Bun source: { command: "bun", args: ["packages/lsp-tools-mcp/src/cli.ts", "mcp"] }
  // - Node dist:  { command: "node", args: ["packages/lsp-tools-mcp/dist/cli.js", "mcp"] }
  return null
}
