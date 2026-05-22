import type { RemoteMcpConfig } from "./types"

/**
 * Exa/Tavily web search MCP server.
 * Defaults to Exa; switch to Tavily by setting TAVILY_API_KEY env var.
 */
export function createWebsearchConfig(): RemoteMcpConfig | null {
  const tavilyKey = process.env.TAVILY_API_KEY
  const exaKey = process.env.EXA_API_KEY

  if (tavilyKey) {
    return {
      type: "remote",
      url: "https://mcp.tavily.com",
      enabled: true,
      headers: {
        Authorization: `Bearer ${tavilyKey}`,
      },
    }
  }

  if (exaKey) {
    return {
      type: "remote",
      url: "https://mcp.exa.ai",
      enabled: true,
      headers: {
        "X-Api-Key": exaKey,
      },
    }
  }

  // Return Exa endpoint without auth (may have rate limits)
  return {
    type: "remote",
    url: "https://mcp.exa.ai",
    enabled: true,
  }
}
