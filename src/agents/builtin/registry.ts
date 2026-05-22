import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentFactory } from "../types"
import { createCanshishiAgent } from "../canshishi"
import { createXinxizhongxinAgent } from "../xinxizhongxin"
import { createFenxibanAgent } from "../fenxiban"
import { createGuowuyuanAgent } from "../guowuyuan"
import { createFagaiweiAgent } from "../fagaiwei"
import { createKejibuAgent } from "../kejibu"
import { createGongxinbuAgent } from "../gongxinbu"
import { createYingjibuAgent } from "../yingjibu"
import { createZhujianbuAgent } from "../zhujianbu"
import { createJiaoyubuAgent } from "../jiaoyubu"
import { createJianweiAgent } from "../jianwei"
import { createShenjishuAgent } from "../shenjishu"
import { createDanganjuAgent } from "../danganju"

/** Built-in agent names */
export const BUILTIN_AGENT_NAMES = [
  "canshishi", "xinxizhongxin", "fenxiban",
  "guowuyuan", "fagaiwei", "kejibu",
  "gongxinbu", "yingjibu", "zhujianbu", "jiaoyubu",
  "jianwei", "shenjishu", "danganju",
] as const

export type BuiltinAgentName = (typeof BUILTIN_AGENT_NAMES)[number]

export const agentSources: Record<BuiltinAgentName, AgentFactory> = {
  canshishi: createCanshishiAgent, xinxizhongxin: createXinxizhongxinAgent, fenxiban: createFenxibanAgent,
  guowuyuan: createGuowuyuanAgent, fagaiwei: createFagaiweiAgent, kejibu: createKejibuAgent,
  gongxinbu: createGongxinbuAgent, yingjibu: createYingjibuAgent,
  zhujianbu: createZhujianbuAgent, jiaoyubu: createJiaoyubuAgent,
  jianwei: createJianweiAgent, shenjishu: createShenjishuAgent, danganju: createDanganjuAgent,
}

export async function createBuiltinAgents(
  models: Record<string, string>, disabledAgents: string[] = [],
): Promise<Record<string, AgentConfig>> {
  const configs: Record<string, AgentConfig> = {}
  for (const [name, factory] of Object.entries(agentSources)) {
    if (disabledAgents.includes(name)) continue
    // Only set model when user explicitly overrides; OpenCode picks default otherwise
    const model = models[name] || ""
    const config = (factory as AgentFactory)(model)
    if (!models[name]) {
      // Clear model field so OpenCode uses its built-in default
      delete (config as Record<string, unknown>).model
    }
    ;(config as { mode?: string }).mode = (factory as AgentFactory).mode
    configs[name] = config
  }
  return configs
}
