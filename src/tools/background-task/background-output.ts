import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { TaskManager } from "../delegate-task/task-manager"

export function createBackgroundOutput(manager: TaskManager): ToolDefinition {
  return tool({
    description:
      "Get output from a background task. For pending/running tasks, polls the session and returns output if available.",
    args: {
      task_id: tool.schema.string().describe("Task ID (session ID) to get output from"),
    },
    execute: async (args) => {
      try {
        const taskId = args.task_id as string
        const task = manager.getTask(taskId)

        if (!task) return `Task not found: ${taskId}`

        // Already errored or completed
        if (task.status === "error") return `Error: ${task.error ?? "Unknown error"}`
        if (task.status === "completed") return task.output ?? "Completed with no output."

        // Still running — try polling
        if (task.status === "running") {
          const result = await manager.poll(task.sessionId, 10) // short poll
          if (result.status === "completed") {
            return result.output ?? "Completed with no output."
          }
          if (result.status === "error") {
            return `Error: ${result.error ?? "Unknown error"}`
          }
          return "Still running. Check again with stp_background_output."
        }

        return `Status: ${task.status}`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
