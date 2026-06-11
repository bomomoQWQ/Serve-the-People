import type { PluginModule, Plugin, Hooks } from "@opencode-ai/plugin"
import { createBuiltinAgents } from "../agents/builtin"
import { loadPluginConfig, ensureDefaultConfig } from "../plugin-config"
import { createBuiltinMcps } from "../mcp"
import { createTools } from "../create-tools"
import { createHooks } from "../create-hooks"
import { createManagers } from "../create-managers"
import { createPluginInterface } from "../plugin-interface"
import { createWorkgroupIdleWake } from "../hooks/workgroup-idle-wake"
import { JianweiMonitor } from "../hooks/jianwei-monitor"
import { initWorkgroupState } from "../features/workgroup/state"
import { initMailbox } from "../features/workgroup/mailbox"
import { initTasklist } from "../features/workgroup/tasklist"
import { initPipelineState } from "../features/pipeline/state"
import { initShenjishuState } from "../tools/shenjishu/tools"
import { initShenjishuAutoTrigger } from "../features/shenjishu/auto-trigger"
import type { AgentConfig } from "@opencode-ai/sdk"

/**
 * Create the Serve the People plugin module.
 *
 * Initialization pipeline:
 *   1. Load config
 *   2. Create built-in agents
 *   3. Create managers
 *   4. Build MCP services
 *   5. Create tools
 *   6. Compose hooks
 *   7. Return plugin interface
 */
export function createPluginModule(): PluginModule {
  const serverPlugin: Plugin = async (input): Promise<Hooks> => {
    const pluginConfig = loadPluginConfig(input.directory)
    ensureDefaultConfig(input.directory)

    // Initialize storage paths from workspace root (prevents cwd dependency)
    initWorkgroupState(input.directory)
    initMailbox(input.directory)
    initTasklist(input.directory)
    initPipelineState(input.directory)
    initShenjishuState(input.directory)
    initShenjishuAutoTrigger(input.directory)

    // Create built-in agents with model overrides from config
    const modelOverrides: Record<string, string> = {}
    if (pluginConfig.agents) {
      for (const [name, cfg] of Object.entries(pluginConfig.agents)) {
        const override = cfg as { model?: string }
        if (override.model) modelOverrides[name] = override.model
      }
    }
    const disabledAgents: string[] = []
    const builtinAgents = await createBuiltinAgents(modelOverrides, disabledAgents)

    const managers = createManagers()
    const disabledMcps = collectDisabledMcps(pluginConfig)
    const mcps = createBuiltinMcps(disabledMcps)
    const tools = createTools(input)

    // Workgroup idle-wake: detects idle workgroup member sessions and nudges them
    const idleWake = createWorkgroupIdleWake({ client: input.client })

    const rawHooks = createPluginInterface(
      input,
      pluginConfig,
      mcps,
      tools,
      builtinAgents,
      idleWake,
    )

    // 国家监委: heartbeat monitoring, stall detection, retry, escalation
    const monitor = new JianweiMonitor(
      input.client,
      pluginConfig,
      input.project.worktree,
    )
    const hooks = createHooks(rawHooks, monitor)

    return hooks
  }

  return {
    id: "serve-the-people",
    server: serverPlugin,
  }
}

function collectDisabledMcps(config: { mcp?: Record<string, boolean> }): string[] {
  const disabled: string[] = []
  if (config.mcp) {
    for (const [name, enabled] of Object.entries(config.mcp)) {
      if (!enabled) disabled.push(name)
    }
  }
  return disabled
}
