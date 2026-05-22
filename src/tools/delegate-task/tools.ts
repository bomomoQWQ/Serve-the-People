import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"
import { agentSources } from "../../agents/builtin/registry"
import { TaskManager } from "./task-manager"
import { registerBackgroundTask } from "../../hooks/background-notify"

/**
 * Create the delegate-task tools.
 * Uses OpenCode SDK session.create() + session.prompt() to spawn real child sessions.
 */
export function createDelegateTask(ctx: PluginInput): Record<string, ToolDefinition> {
  const manager = new TaskManager(ctx.client)

  const taskTool: ToolDefinition = tool({
    description:
      "Spawn a sub-agent in a real child session. " +
      "Set run_in_background=true to fire-and-forget (use stp_background_output to collect later). " +
      "Set run_in_background=false to block until completion. " +
      "Use subagent_type: canshishi, xinxizhongxin, fenxiban, fagaiwei, gongxinbu, kejibu, etc.",
    args: {
      subagent_type: tool.schema.string()
        .describe("Agent to spawn"),
      prompt: tool.schema.string().describe("Task prompt to send"),
      description: tool.schema.string().optional().describe("Short description"),
      run_in_background: tool.schema.boolean().optional()
        .describe("true = fire-and-forget (use stp_background_output later). false = block until done. Default false."),
    },
    execute: async (args, context) => {
      const agent = args.subagent_type as string
      const prompt = args.prompt as string
      const runInBackground = (args.run_in_background as boolean) ?? false
      if (!agent) return "Error: subagent_type required."
      if (!prompt) return "Error: prompt required."
      if (!agentSources[agent as keyof typeof agentSources]) {
        return `Error: Unknown agent "${agent}". Available: ${Object.keys(agentSources).join(", ")}`
      }

      const ctx = context as Record<string, unknown>
      const parentSessionId = (ctx.sessionID ?? ctx.session_id ?? "") as string

      const task = await manager.launch({
        agent,
        prompt,
        description: args.description as string | undefined,
        parentSessionId,
        onSessionCreated: runInBackground
          ? (sid) => registerBackgroundTask({ sessionId: sid, parentSessionId, agent })
          : undefined,
      })

      if (task.status === "error") {
        return `Error: ${task.error}`
      }

      if (runInBackground) {
        return `Task dispatched: ${task.sessionId}\nAgent: ${agent}\nWait for <system-reminder> notification then use stp_background_output(task_id="${task.sessionId}") to collect results.`
      }

      // Sync mode: poll for completion
      const result = await manager.poll(task.sessionId)
      if (result.status === "completed") {
        return result.output ?? "(no output)"
      }
      return `Error: ${result.error ?? "Unknown error"}`
    },
  })

  return { stp_task: taskTool }
}
