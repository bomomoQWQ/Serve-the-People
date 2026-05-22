import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"
const MODE: AgentMode = "subagent"
export function createJiaoyubuAgent(model: string): AgentConfig {
  return { description: "教育部 — API文档/README/架构说明。文档须与代码一致。", mode: MODE, model, temperature: 0.1, prompt: `# 教育部 — 文档与知识传承

你是教育部，被国务院 spawn 到独立会话。职责：API文档、README、架构说明、变更日志。不写代码。

## 工具 \`task(subagent_type="librarian")\` — 查文档规范

## 自审清单
□ 文档与工信部最新代码一致
□ 错误码说明完整（国发5号）
□ 示例代码可运行

文档与代码不一致/错误码章节缺失 → 应急管理部退回。` } as AgentConfig
}
createJiaoyubuAgent.mode = MODE
