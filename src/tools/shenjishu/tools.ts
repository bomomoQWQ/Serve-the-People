/**
 * 审计署工具 — audit state read/write.
 *
 * 审计署是 task() 一次性调用，每次独立会话。
 * 通过文件持久化跟踪审计轮次和失败记录。
 * Layout: .servethepeople/teams/{teamId}/audit.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

const TEAMS_BASE = ".servethepeople/teams"

interface AuditState {
  workgroupId: string
  round: number
  lastFailures: string[]
  lastTimestamp: string
}

function auditPath(workgroupId: string): string {
  return join(TEAMS_BASE, workgroupId, "audit.json")
}

function readState(workgroupId: string): AuditState | null {
  const path = auditPath(workgroupId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AuditState
  } catch {
    return null
  }
}

function writeState(state: AuditState): void {
  const dir = join(TEAMS_BASE, state.workgroupId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(auditPath(state.workgroupId), JSON.stringify(state, null, 2))
}

export function persistAuditState(workgroupId: string, round: number, failures: string[]): void {
  writeState({
    workgroupId,
    round,
    lastFailures: failures,
    lastTimestamp: new Date().toISOString(),
  })
}

export function createShenjishuTools(): Record<string, ToolDefinition> {
  const shenjishuAudit: ToolDefinition = tool({
    description:
      "读取或更新审计状态：当前第几轮、上次哪些项不合格。审计署每次被 task() 调用时用它了解上下文。",
    args: {
      action: tool.schema.string()
        .describe("操作: read（读取当前状态）, write（更新状态）"),
      workgroup_id: tool.schema.string()
        .describe("工作组 ID"),
      round: tool.schema.number().optional()
        .describe("当前轮次（write 时必传，1-3）"),
      failures: tool.schema.array(tool.schema.string()).optional()
        .describe("本次未通过的检查项列表（write 时传）"),
    },
    execute: async (args) => {
      const action = args.action as string
      const workgroupId = args.workgroup_id as string

      switch (action) {
        case "read": {
          const state = readState(workgroupId)
          if (!state) {
            return `审计状态: 第 1 轮（首次验收），暂无历史记录。`
          }
          const failures = state.lastFailures.length > 0
            ? `\n上轮不合格项:\n${state.lastFailures.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
            : ""
          return `审计状态: 第 ${state.round} 轮，上次时间 ${state.lastTimestamp}${failures}`
        }
        case "write": {
          const round = args.round as number | undefined
          const failures = (args.failures as string[] | undefined) ?? []
          if (!round || round < 1 || round > 3) {
            return "错误：round 必须为 1-3"
          }
          writeState({ workgroupId, round, lastFailures: failures, lastTimestamp: new Date().toISOString() })
          if (failures.length === 0) {
            return `✅ 审计状态已更新: 第 ${round} 轮，全部通过。`
          }
          return `⚠️ 审计状态已更新: 第 ${round} 轮，${failures.length} 项未通过。`
        }
        default:
          return `错误：未知操作 "${action}"，可选: read, write`
      }
    },
  })

  return { stp_shenjishu_audit: shenjishuAudit }
}
