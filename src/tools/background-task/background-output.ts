import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"
import type { TaskManager } from "../delegate-task/task-manager"

export function createBackgroundOutput(manager: TaskManager, client: PluginInput["client"]): ToolDefinition {
  return tool({
    description:
      "获取背景任务输出。已完成的任务直查 session API，短任务和长任务都适用。",
    args: {
      task_id: tool.schema.string().describe("Task ID (session ID) to get output from"),
    },
    execute: async (args) => {
      try {
        const taskId = args.task_id as string
        const task = manager.getTask(taskId)

        if (task) {
          if (task.status === "error") return `Error: ${task.error ?? "Unknown error"}`
          if (task.status === "completed") return task.output ?? "(no output)"
          if (task.status === "running") {
            const result = await manager.poll(task.sessionId, 5)
            if (result.status === "completed") return result.output ?? "(no output)"
            if (result.status === "error") return `Error: ${result.error ?? "Unknown error"}`
            return "Still running."
          }
        }

        // Try polling the session directly (even if not tracked in memory)
        const result = await manager.poll(taskId, 3)
        if (result.status === "completed" && result.output) return result.output
        if (result.status === "error" && result.error) return `Error: ${result.error}`

        // Last resort: query session messages directly
        const sessionApi = client.session as unknown as Record<string, unknown> | undefined
        if (typeof sessionApi?.messages === "function") {
          const msgResult = await (sessionApi.messages as (opts: { path: { id: string } }) => Promise<{ data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> }>)({ path: { id: taskId } })
          const msgs = msgResult?.data
          if (msgs && msgs.length > 0) {
            for (let j = msgs.length - 1; j >= 0; j--) {
              const msg = msgs[j]
              if (msg.info?.role === "assistant") {
                const output = (msg.parts ?? [])
                  .filter((p) => p.type === "text")
                  .map((p) => p.text ?? "")
                  .join("\n")
                return output || "(no output)"
              }
            }
          }
        }

        return `Task completed but output unavailable (session=${taskId.slice(0, 12)}... may have been cleaned up). Try stp_background_output again.`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
