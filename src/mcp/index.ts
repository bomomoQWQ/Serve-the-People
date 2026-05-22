import { createWebsearchConfig } from "./websearch"
import { context7 } from "./context7"
import { grepApp } from "./grep-app"
import { createLspMcpConfig } from "./lsp"
import { createAstGrepMcpConfig } from "./ast-grep"
import type { BuiltinMcpConfig } from "./types"

/**
 * Create all built-in MCP server configurations.
 * @param disabledMcps - list of MCP names to disable
 */
export function createBuiltinMcps(
  disabledMcps: string[] = [],
): Record<string, BuiltinMcpConfig> {
  const mcps: Record<string, BuiltinMcpConfig> = {}

  if (!disabledMcps.includes("websearch")) {
    const websearchConfig = createWebsearchConfig()
    if (websearchConfig) {
      mcps.websearch = websearchConfig
    }
  }

  if (!disabledMcps.includes("context7")) {
    mcps.context7 = context7
  }

  if (!disabledMcps.includes("grep_app")) {
    mcps.grep_app = grepApp
  }

  if (!disabledMcps.includes("lsp")) {
    const lspConfig = createLspMcpConfig()
    if (lspConfig) {
      mcps.lsp = lspConfig
    }
  }

  if (!disabledMcps.includes("ast_grep")) {
    const astGrepConfig = createAstGrepMcpConfig()
    if (astGrepConfig) {
      mcps.ast_grep = astGrepConfig
    }
  }

  return mcps
}
