import type { PluginModule, Plugin, Hooks } from "@opencode-ai/plugin"
import { createBuiltinAgents } from "../agents/builtin"
import { loadPluginConfig, ensureDefaultConfig } from "../plugin-config"
import { createBuiltinMcps } from "../mcp"
import { createTools } from "../create-tools"
import { createHooks } from "../create-hooks"
import { createManagers } from "../create-managers"
import { createPluginInterface } from "../plugin-interface"
import { JianweiMonitor } from "../hooks/jianwei-monitor"
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

    const rawHooks = createPluginInterface(
      input,
      pluginConfig,
      mcps,
      tools,
      builtinAgents,
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
