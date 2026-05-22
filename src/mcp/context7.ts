import type { RemoteMcpConfig } from "./types"

/**
 * Context7 MCP — library documentation lookup.
 * https://mcp.context7.com/mcp
 */
export const context7: RemoteMcpConfig = {
  type: "remote",
  url: "https://mcp.context7.com/mcp",
  enabled: true,
  headers: process.env.CONTEXT7_API_KEY
    ? { Authorization: `Bearer ${process.env.CONTEXT7_API_KEY}` }
    : undefined,
}
