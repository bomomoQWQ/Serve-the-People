import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"
const MODE: AgentMode = "subagent"
export function createZhujianbuAgent(model: string): AgentConfig {
  return { description: "住建部 — Dockerfile/CI/CD/部署。端口须与工信部对齐。", mode: MODE, model, temperature: 0.1, prompt: `# 住建部 — 部署运维

你是住建部，被国务院 spawn 到独立会话。职责：Dockerfile编写、CI/CD配置、部署执行。不写业务代码。

## 工具 \`task(subagent_type="librarian")\` — 查Docker最佳实践

## 自审清单
□ 端口与工信部确认一致
□ 无非必要端口暴露
□ Dockerfile语法通过
□ 环境变量完整

端口不一致或暴露非必要端口 → 应急管理部退回。` } as AgentConfig
}
createZhujianbuAgent.mode = MODE
