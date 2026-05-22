import type { ToolDefinition, PluginInput } from "@opencode-ai/plugin"
import { createGrepTools } from "./tools/grep"
import { createGlobTools } from "./tools/glob"
import { createSessionManagerTools } from "./tools/session-manager"
import { createDelegateTask } from "./tools/delegate-task"
import { createWorkgroupTools } from "./tools/workgroup/tools"
import { createDanganjuTools } from "./tools/danganju/tools"
import { createShenjishuTools } from "./tools/shenjishu/tools"
import { createBackgroundOutput, createBackgroundCancel } from "./tools/background-task"
import { createSkillTool } from "./tools/skill"
import { createSkillMcpTool } from "./tools/skill-mcp"
import { TaskManager } from "./tools/delegate-task/task-manager"

/**
 * Tool registry factory.
 * Creates all built-in tools for the Serve the People plugin.
 */
export function createTools(ctx: PluginInput): Record<string, ToolDefinition> {
  const tools: Record<string, ToolDefinition> = {}

  // Shared TaskManager for delegate-task and background-task tools
  const taskManager = new TaskManager(ctx.client)

  // Search tools
  Object.assign(tools, createGrepTools())
  Object.assign(tools, createGlobTools())

  // Session management tools
  Object.assign(tools, createSessionManagerTools(ctx))

  // Task delegation — inline via agent prompt injection
  Object.assign(tools, createDelegateTask(ctx))

  // Workgroup management tools
  Object.assign(tools, createWorkgroupTools(ctx))

  // Archive (档案局) tools
  Object.assign(tools, createDanganjuTools())

  // Audit (审计署) tools
  Object.assign(tools, createShenjishuTools())

  // Background task tools
  Object.assign(tools, {
    background_output: createBackgroundOutput(taskManager),
    background_cancel: createBackgroundCancel(taskManager),
  })

  // Skill tools
  Object.assign(tools, {
    skill: createSkillTool(),
    skill_mcp: createSkillMcpTool(ctx.client),
  })

  return tools
}
