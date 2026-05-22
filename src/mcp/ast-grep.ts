import type { LocalMcpConfig } from "./types"

/**
 * AST-grep MCP — AST-aware code search and replace.
 * Local stdio MCP backed by the ast-grep-mcp package.
 *
 * TODO: Set up ast-grep-mcp as a git submodule or npm dependency.
 * For now this is a placeholder that returns null — AST-grep MCP won't be
 * available until the ast-grep-mcp package is configured.
 */
export function createAstGrepMcpConfig(): LocalMcpConfig | null {
  // Placeholder: returns null until ast-grep-mcp is set up
  // When ready:
  // - Bun source: { command: "bun", args: ["packages/ast-grep-mcp/src/cli.ts", "mcp"] }
  // - Node dist:  { command: "node", args: ["packages/ast-grep-mcp/dist/cli.js", "mcp"] }
  return null
}
