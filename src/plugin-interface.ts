import type { Hooks, PluginInput, ToolDefinition } from "@opencode-ai/plugin"
import type { AgentConfig } from "@opencode-ai/sdk"
import type { ServeThePeopleConfig } from "./config"
import type { BuiltinMcpConfig } from "./mcp/types"
import { processUserMessage } from "./features/pipeline/coordinator"

/** In-memory pipeline state per session */
const sessions = new Map<string, { taskId?: string }>()

/**
 * Plugin interface — maps hook names to handlers.
 */
export function createPluginInterface(
  _ctx: PluginInput,
  pluginConfig: ServeThePeopleConfig,
  mcps: Record<string, BuiltinMcpConfig>,
  tools: Record<string, ToolDefinition>,
  builtinAgents: Record<string, AgentConfig>,
): Omit<Hooks, "experimental.session.compacting" | "experimental.compaction.autocontinue"> {
  return {
    /** Register tools — OpenCode expects { [name]: ToolDefinition }, not a function */
    tool: tools,

    /** Configure plugin — register agents, MCP servers */
    config: async (input) => {
      // Register agents with OpenCode
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
     * 国家监委 (jianwei) monitoring is composed on top of this handler
     * by createHooks() — stall detection, retry, escalation, and
     * periodic memorial reports are all driven from the event stream.
     */
    event: async (event) => {
      if (pluginConfig.debug) {
        console.log(`[serve-the-people] event: ${event.event.type}`)
      }
    },

    /** Chat message — user interaction → 国务院 pipeline */
    "chat.message": async (input, output) => {
      const sessionId = input.sessionID
      if (!sessionId) return

      const session = sessions.get(sessionId) ?? { taskId: undefined }
      sessions.set(sessionId, session)

      // Pull user text from the message parts
      const parts = output.parts ?? []
      const userText = parts
        .filter((p: Record<string, unknown>) => p.type === "text")
        .map((p: Record<string, unknown>) => p.text as string)
        .join("\n")

      if (!userText) return

      // Process through pipeline
      const result = processUserMessage(userText, session.taskId)

      // Store updated task ID
      if (result.userMessage) {
        // The coordinator advanced the pipeline — extract task ID from the message
        const match = result.userMessage.match(/TASK-\d{8}-\d{3}/)
        if (match) session.taskId = match[0]
      }

      // Inject system context into the agent prompt
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
    "tool.execute.before": async (_ctx) => {
      // Phase 5+: self-review check gates
    },

    /** Tool post-execution hooks */
    "tool.execute.after": async (_ctx) => {
      // Phase 5+: validation hooks
    },

    /** System message transform */
    "experimental.chat.system.transform": async (_ctx) => {
      // Phase 3+: workgroup context injection
    },
  }
}
