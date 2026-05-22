/** Remote HTTP MCP server configuration */
export type RemoteMcpConfig = {
  type: "remote"
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: false
}

/** Local stdio MCP server configuration */
export type LocalMcpConfig = {
  type: "local"
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}

/** Union of all built-in MCP config types */
export type BuiltinMcpConfig = RemoteMcpConfig | LocalMcpConfig

/** Names of built-in MCP services */
export const MCP_NAMES = ["websearch", "context7", "grep_app", "lsp", "ast_grep"] as const
export type McpName = (typeof MCP_NAMES)[number]
