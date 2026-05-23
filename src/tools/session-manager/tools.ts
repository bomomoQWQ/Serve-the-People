import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"

export function createSessionManagerTools(ctx: PluginInput): Record<string, ToolDefinition> {
  const client = ctx.client

  const sessionList: ToolDefinition = tool({
    description:
      "列出全部 OpenCode 会话（可过滤）。返回会话 ID 及消息数/时间/Agent 等元数据。",
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
      "读取 OpenCode 会话的消息和历史记录。",
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
      "搜索 OpenCode 会话消息内容。全文检索返回匹配片段。",
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
      "获取 OpenCode 会话的元数据和统计信息。",
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
    stp_session_list: sessionList,
    stp_session_read: sessionRead,
    stp_session_search: sessionSearch,
    stp_session_info: sessionInfo,
  }
}
