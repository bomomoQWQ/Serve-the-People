/**
 * AST-grep tools are now provided as native tools (src/tools/ast-grep-search/).
 * The MCP approach has been replaced with a simple @ast-grep/cli wrapper.
 * This file remains for backwards compatibility only.
 */
import type { LocalMcpConfig } from "./types"

export function createAstGrepMcpConfig(): LocalMcpConfig | null {
  // AST-grep tools are native now — no MCP server needed.
  return null
}
