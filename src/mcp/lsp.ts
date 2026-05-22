/**
 * LSP tools are now provided as native tools (src/tools/lsp-diagnostics/).
 * The MCP approach has been replaced with a simpler tsc wrapper.
 * This file remains for backwards compatibility only.
 */
import type { LocalMcpConfig } from "./types"

export function createLspMcpConfig(): LocalMcpConfig | null {
  // LSP tools are native now — no MCP server needed.
  return null
}
