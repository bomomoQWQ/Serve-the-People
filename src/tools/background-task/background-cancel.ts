import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { TaskManager } from "../delegate-task/task-manager"

const BACKGROUND_CANCEL_DESCRIPTION = `Cancel running background task(s). Use all=true to cancel ALL before final answer.`

export function createBackgroundCancel(manager: TaskManager): ToolDefinition {
  return tool({
    description: BACKGROUND_CANCEL_DESCRIPTION,
    args: {
      taskId: tool.schema.string().optional()
        .describe("Task ID to cancel (required if all=false)"),
      all: tool.schema.boolean().optional()
        .describe("Cancel all running background tasks (default: false)"),
    },
    execute: async (args) => {
      try {
        const cancelAll = args.all === true

        if (cancelAll) {
          const count = manager.cancelAll()
          return count > 0
            ? `Cancelled ${count} task(s).`
            : "No tasks to cancel."
        }

        const taskId = args.taskId as string | undefined
        if (!taskId) {
          return "Error: Provide taskId or set all=true to cancel all running tasks."
        }

        const cancelled = manager.cancel(taskId)
        if (!cancelled) {
          return `Task not found: ${taskId}`
        }

        return `Task ${taskId} cancelled.`
      } catch (e) {
        return `Error cancelling task: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
