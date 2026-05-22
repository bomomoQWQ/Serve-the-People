import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { TaskManager } from "../delegate-task/task-manager"

export function createBackgroundOutput(manager: TaskManager): ToolDefinition {
  return tool({
    description: "Get output from a background task. Returns the task's stored output if available.",
    args: {
      task_id: tool.schema.string().describe("Task ID to get output from"),
    },
    execute: async (args) => {
      try {
        const taskId = args.task_id as string
        const task = manager.getTask(taskId)

        if (!task) return `Task not found: ${taskId}`
        if (task.status === "error") return `Error: ${task.error ?? "Unknown error"}`
        if (task.status === "completed") return task.output ?? "Completed with no output."
        if (task.status === "running") return "Still running."
        return `Status: ${task.status}`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
