import type { Hooks, PluginInput, ToolDefinition } from "@opencode-ai/plugin"
import type { AgentConfig } from "@opencode-ai/sdk"
import type { ServeThePeopleConfig } from "./config"
import type { BuiltinMcpConfig } from "./mcp/types"
import { processUserMessage } from "./features/pipeline/coordinator"
import { createWorkgroupMailboxInjector, type MailboxInjectorHook } from "./hooks/workgroup-mailbox-injector"
import { handleBackgroundTaskIdle } from "./hooks/background-notify"

/** In-memory pipeline state per session */
const sessions = new Map<string, { taskId?: string }>()

type WorkgroupIdleWakeFn = (sessionId: string) => Promise<void>

/**
 * Plugin interface — maps hook names to handlers.
 */
export function createPluginInterface(
  ctx: PluginInput,
  pluginConfig: ServeThePeopleConfig,
  mcps: Record<string, BuiltinMcpConfig>,
  tools: Record<string, ToolDefinition>,
  builtinAgents: Record<string, AgentConfig>,
  workgroupIdleWake?: WorkgroupIdleWakeFn,
): Omit<Hooks, "experimental.session.compacting" | "experimental.compaction.autocontinue"> {
  // Mailbox injector hook
  const mailboxInjector = createWorkgroupMailboxInjector()
  const messagesTransform = mailboxInjector["experimental.chat.messages.transform"]

  return {
    /** Register tools */
    tool: tools,

    /** Configure plugin — register agents, MCP servers */
    config: async (input) => {
      const cfg = input as Record<string, unknown>
      const existingAgents = (cfg.agent ?? {}) as Record<string, unknown>
      for (const [name, agentConfig] of Object.entries(builtinAgents)) {
        existingAgents[name] = agentConfig
      }
      cfg.agent = existingAgents

      if (pluginConfig.debug) {
        const agentNames = Object.keys(builtinAgents)
        const mcpNames = Object.keys(mcps)
        console.log(
          `[serve-the-people] Agents: ${agentNames.join(", ")} | MCPs: ${mcpNames.join(", ") || "none"}`,
        )
      }
    },

    /**
     * Session lifecycle events.
     * Handles session.idle → workgroup member wake.
     */
    event: async (event) => {
      if (pluginConfig.debug) {
        console.log(`[serve-the-people] event: ${event.event.type}`)
      }

      // Idle → workgroup wake + background task notify
      if (event.event.type === "session.idle") {
        const props = event.event.properties as { session?: { id?: string } } | undefined
        const sessionId = props?.session?.id
        if (sessionId) {
          workgroupIdleWake?.(sessionId).catch(() => {})
          handleBackgroundTaskIdle(ctx.client, sessionId).catch(() => {})
        }
      }
    },

    /** Chat message — user interaction → 国务院 pipeline */
    "chat.message": async (input, output) => {
      const sessionId = input.sessionID
      if (!sessionId) return

      const session = sessions.get(sessionId) ?? { taskId: undefined }
      sessions.set(sessionId, session)

      const parts = output.parts ?? []
      const userText = parts
        .filter((p: Record<string, unknown>) => p.type === "text")
        .map((p: Record<string, unknown>) => p.text as string)
        .join("\n")

      if (!userText) return

      const result = processUserMessage(userText, session.taskId)

      if (result.userMessage) {
        const match = result.userMessage.match(/TASK-\d{8}-\d{3}/)
        if (match) session.taskId = match[0]
      }

      if (result.systemMessage) {
        const part = { type: "text", text: result.systemMessage } as unknown
        output.parts = [...parts, part] as typeof output.parts
      }

      if (pluginConfig.debug) {
        console.log(
          "[serve-the-people] chat.message:",
          `session=${sessionId.slice(0, 8)}`,
          `task=${session.taskId ?? "none"}`,
          `text=${userText.slice(0, 80)}`,
        )
      }
    },

    /** Tool pre-execution guards */
    "tool.execute.before": async (_ctx) => {},

    /** Tool post-execution hooks */
    "tool.execute.after": async (_ctx) => {},

    /** System message transform */
    "experimental.chat.system.transform": async (_ctx) => {},

    /** Messages transform — mailbox injection for workgroup members */
    "experimental.chat.messages.transform": messagesTransform
      ? async (input, output) => {
          await messagesTransform(input as Parameters<typeof messagesTransform>[0], output as Parameters<typeof messagesTransform>[1])
        }
      : undefined,
  }
}
