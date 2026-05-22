/**
 * 审计署自动验收触发器。
 * 当工作组全部 task 完成时触发验收通知。
 *
 * 审计署是 task() 一次性调用（非长活），由国务院在收到触发通知后
 * 调用 task(subagent_type="shenjishu") 执行验收。出审计报告，不生成《若干问题》。
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { listTasks, type Task } from "../workgroup/tasklist"
import { getWorkgroup, updateWorkgroupStatus } from "../workgroup/state"
import { AUDIT_CHECKLIST } from "./checklist-defs"
import { sendMessage } from "../workgroup/mailbox"
import { persistAuditState } from "../../tools/shenjishu/tools"

export interface AuditResult {
  workgroupId: string
  passed: boolean
  failures: string[]
  round: number
  timestamp: string
}

export async function tryTriggerAudit(workgroupId: string): Promise<AuditResult | null> {
  const workgroup = getWorkgroup(workgroupId)
  if (!workgroup || workgroup.status !== "active") return null

  const tasks = listTasks(workgroupId)
  if (tasks.length === 0) return null

  const allDone = tasks.every((t: Task) => t.status === "completed")
  if (!allDone) return null

  return await runAudit(workgroupId)
}

/**
 * 发送验收触发通知给国务院。
 */
export async function runAudit(workgroupId: string): Promise<AuditResult> {
  const existing = readAuditState(workgroupId)
  const round = (existing?.round ?? 0) + 1

  // Persist to disk so 审计署 can read it via shenjishu_audit tool
  persistAuditState(workgroupId, round, existing?.lastFailures ?? [])

  const checklistSummary = AUDIT_CHECKLIST
    .map((item) => `□ ${item.name} — ${item.description}`)
    .join("\n")

  if (round >= 3) {
    updateWorkgroupStatus(workgroupId, "completed")
  }

  sendMessage(workgroupId, {
    from: "shenjishu",
    to: "guowuyuan",
    kind: "message",
    body: [
      `审计验收触发（第 ${round}/3 轮）`,
      "请国务院调用 stp_task(subagent_type=\"shenjishu\") 执行验收。",
      "审计署可用 shenjishu_audit 工具自助读取当前轮次和历史失败项。",
      round >= 3 ? "此为最终轮，不合格项标记已知缺陷放行。" : "",
      "",
      "### 验收清单",
      checklistSummary,
    ].filter(Boolean).join("\n"),
  })

  return {
    workgroupId,
    passed: false,
    failures: [],
    round,
    timestamp: new Date().toISOString(),
  }
}

function readAuditState(workgroupId: string): { round: number; lastFailures: string[] } | null {
  const path = join(".servethepeople/teams", workgroupId, "audit.json")
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"))
    return { round: data.round as number, lastFailures: data.lastFailures as string[] }
  } catch {
    return null
  }
}

export function getAuditHistory(workgroupId: string) {
  return readAuditState(workgroupId)
}

export function clearAuditHistory(workgroupId: string) {
  const path = join(".servethepeople/teams", workgroupId, "audit.json")
  if (existsSync(path)) unlinkSync(path)
}
