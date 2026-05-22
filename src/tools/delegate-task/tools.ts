import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"
import { agentSources } from "../../agents/builtin/registry"
import { TaskManager } from "./task-manager"

/**
 * Create the delegate-task tools.
 * Uses OpenCode SDK session.create() + session.prompt() to spawn real child sessions.
 */
export function createDelegateTask(ctx: PluginInput): Record<string, ToolDefinition> {
  const manager = new TaskManager(ctx.client)

  const taskTool: ToolDefinition = tool({
    description:
      "Spawn a sub-agent in a real child session. The agent runs independently " +
      "and results are returned when complete. " +
      "Use subagent_type: oracle, librarian, explore, fagaiwei, gongxinbu, kejibu, etc.",
    args: {
      subagent_type: tool.schema.string()
        .describe("Agent to spawn"),
      prompt: tool.schema.string().describe("Task prompt to send"),
      description: tool.schema.string().optional().describe("Short description"),
    },
    execute: async (args, context) => {
      const agent = args.subagent_type as string
      const prompt = args.prompt as string
      if (!agent) return "Error: subagent_type required."
      if (!prompt) return "Error: prompt required."
      if (!agentSources[agent as keyof typeof agentSources]) {
        return `Error: Unknown agent "${agent}". Available: ${Object.keys(agentSources).join(", ")}`
      }

      // Get parent session ID from tool context
      const ctx = context as Record<string, unknown>
      const parentSessionId = (ctx.sessionID ?? ctx.session_id ?? "") as string

      // Spawn real child session
      const task = await manager.launch({
        agent,
        prompt,
        description: args.description as string | undefined,
        parentSessionId,
      })

      if (task.status === "error") {
        return `Error: ${task.error}`
      }

      // Poll for completion
      const result = await manager.poll(task.sessionId)
      if (result.status === "completed") {
        return result.output ?? "Task completed with no output."
      }
      return `Error: ${result.error ?? "Unknown error"}`
    },
  })

  return { stp_task: taskTool }
}
