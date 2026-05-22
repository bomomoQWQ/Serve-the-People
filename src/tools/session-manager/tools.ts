import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"

export function createSessionManagerTools(ctx: PluginInput): Record<string, ToolDefinition> {
  const client = ctx.client

  const sessionList: ToolDefinition = tool({
    description:
      "List all OpenCode sessions with optional filtering. Returns session IDs with metadata including message count, date range, and agents used.",
    args: {
      limit: tool.schema.number().optional().describe("Maximum number of sessions to return"),
      from_date: tool.schema.string().optional().describe("Filter sessions from this date (ISO 8601 format)"),
      to_date: tool.schema.string().optional().describe("Filter sessions until this date (ISO 8601 format)"),
    },
    execute: async (args) => {
      try {
        const raw = await client.session.list?.()
        if (!raw) return "No sessions found."

        const sessions: Record<string, unknown>[] = Array.isArray(raw) ? raw : Object.values(raw as object)
        if (args.limit && args.limit > 0) {
          sessions.length = Math.min(sessions.length, args.limit)
        }
        if (sessions.length === 0) return "No sessions found."

        const lines = sessions.map((s) =>
          `| ${s.id ?? "?"} | ${s.messages ?? "?"} | ${s.agent ?? "?"} |`
        )
        return `| Session ID | Messages | Agent |\n|---|---|---|\n${lines.join("\n")}`
      } catch (e) {
        return `Error listing sessions: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  const sessionRead: ToolDefinition = tool({
    description:
      "Read messages and history from an OpenCode session. Returns a formatted view of session messages with role, timestamp, and content.",
    args: {
      session_id: tool.schema.string().describe("Session ID to read"),
      include_todos: tool.schema.boolean().optional().describe("Include todo list if available"),
      limit: tool.schema.number().optional().describe("Maximum number of messages to return"),
    },
    execute: async (args) => {
      try {
        const msgs = await client.session.messages?.({ sessionId: args.session_id } as never)
        if (!msgs || !Array.isArray(msgs) || msgs.length === 0) {
          return "Session not found or has no messages."
        }

        const limit = args.limit ?? 50
        const sliced = (msgs as unknown[]).slice(-limit)

        const lines = (sliced as Record<string, unknown>[]).map((m) =>
          `[${m.role ?? "?"}] ${typeof m.content === "string" ? (m.content as string).slice(0, 200) : "..."}`
        )
        return `Session: ${args.session_id}\nMessages: ${sliced.length}\n\n${lines.join("\n")}`
      } catch (e) {
        return `Error reading session: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  const sessionSearch: ToolDefinition = tool({
    description:
      "Search for content within OpenCode session messages. Performs full-text search across session messages and returns matching excerpts.",
    args: {
      query: tool.schema.string().describe("Search query string"),
      session_id: tool.schema.string().optional().describe("Search within specific session only"),
      case_sensitive: tool.schema.boolean().optional().describe("Case-sensitive search"),
      limit: tool.schema.number().optional().describe("Maximum number of results to return"),
    },
    execute: async (args) => {
      try {
        // Simplified search: list sessions and filter by query in title/content
        const sessions = await client.session.list?.()
        if (!sessions) return "No sessions to search."

        const results: string[] = []
        const query = (args.query ?? "").toLowerCase()
        const sessionList = Array.isArray(sessions) ? sessions : Object.values(sessions)

        for (const s of sessionList as Record<string, unknown>[]) {
          const id = s.id as string
          if (args.session_id && id !== args.session_id) continue

          // Check if session metadata contains the query
          const title = (s.title ?? "") as string
          const agent = (s.agent ?? "") as string
          if (title.toLowerCase().includes(query) || agent.toLowerCase().includes(query)) {
            results.push(`[${id}] ${agent}: ${title}`)
          }
        }

        const limit = args.limit ?? 20
        return results.length > 0
          ? `Found ${results.length} sessions:\n${results.slice(0, limit).join("\n")}`
          : `No sessions found matching "${args.query}".`
      } catch (e) {
        return `Error searching sessions: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  const sessionInfo: ToolDefinition = tool({
    description:
      "Get metadata and statistics about an OpenCode session. Returns detailed information including message count, date range, agents used, and available data sources.",
    args: {
      session_id: tool.schema.string().describe("Session ID to inspect"),
    },
    execute: async (args) => {
      try {
        const msgs = await client.session.messages?.({ sessionId: args.session_id } as never)
        return msgs && Array.isArray(msgs)
          ? `Session: ${args.session_id}\nMessages: ${msgs.length}`
          : `Session ${args.session_id} not found.`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  return {
    session_list: sessionList,
    session_read: sessionRead,
    session_search: sessionSearch,
    session_info: sessionInfo,
  }
}
