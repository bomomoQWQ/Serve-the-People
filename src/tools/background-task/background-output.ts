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

        // If task in memory — use cached result
        if (task) {
          if (task.status === "error") return `Error: ${task.error ?? "Unknown error"}`
          if (task.status === "completed") return task.output ?? "Completed with no output."
          if (task.status === "running") {
            const result = await manager.poll(task.sessionId, 10)
            if (result.status === "completed") return result.output ?? "Completed with no output."
            if (result.status === "error") return `Error: ${result.error ?? "Unknown error"}`
            return "Still running. Check again."
          }
        }

        // Task not in memory (completed and cleaned up, or never tracked)
        // Try querying the session directly
        if (client.session?.messages) {
          const msgResult = await client.session.messages({ path: { id: taskId } })
          const msgs = msgResult.data
          if (msgs && msgs.length > 0) {
            // Find last assistant message
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

        // If the session ID looks like a direct session ID, it might have completed
        if (taskId.length > 8) {
          return "Task completed but output unavailable (session may have been cleaned up)."
        }
        return `Task not found: ${taskId}`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
