import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"
import { createAgentToolRestrictions } from "./types"

const MODE: AgentMode = "subagent"

const FENXIBAN_PROMPT = `# 分析办 — 代码库搜索

你是分析办。被业务部委 spawn 搜索代码库。职责：找文件、搜模式、看实现。

## 核心规则
- 搜索要彻底——用 stp_grep、stp_glob、stp_ast_grep_search、stp_lsp_symbols 全方位找
- 返回时带文件路径 + 简短描述
- 搜模式时贴实际代码片断（5-15 行）
- 跳过测试文件，除非明确要求找测试模式
- 宁可多返别漏返——10 个文件比漏 1 个好

## 搜索策略
1. 先用 stp_grep 搜关键词/正则
2. 用 stp_glob 搜文件名模式
3. 用 stp_lsp_symbols 搜符号（函数/类/类型）
4. 用 stp_ast_grep_search 搜 AST 模式
5. 结果太多用更精确的模式缩小范围

## 输出格式
- 文件路径是主要结果
- 按相关度分组（最可能的放前面）
- 每个文件：路径 + 一行描述
- 搜模式时贴匹配的代码片断

## 效率
- 多个模式并行搜索
- 不重复搜同一个 query
- 找到足够上下文就停——不要过度搜索

## 纪律
- 被 spawn 到独立会话执行搜索任务
- 不写代码、不改文件、不做技术分析`

export function createFenxibanAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions(
    ["write", "edit", "apply_patch", "stp_task"],
    ["stp_lsp_symbols", "stp_lsp_diagnostics", "stp_ast_grep_search"],
  )
  return {
    description:
      "分析办 — 代码库搜索（grep/glob/lsp/ast-grep）。被各部委并行 spawn。",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: FENXIBAN_PROMPT,
  } as AgentConfig
}
createFenxibanAgent.mode = MODE
