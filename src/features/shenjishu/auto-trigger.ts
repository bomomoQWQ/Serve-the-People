/**
 * 审计署自动验收触发器。
 * 当工作组全部 task 完成时触发验收。
 * 审计署是黑盒用户视角：不读代码，只按文档走流程验证功能。
 */

import { listTasks, type Task } from "../workgroup/tasklist"
import { getWorkgroup, updateWorkgroupStatus } from "../workgroup/state"
import { AUDIT_CHECKLIST } from "./checklist-defs"
import { sendMessage } from "../workgroup/mailbox"
import { runArchiving } from "../pipeline/learning"

export interface AuditResult {
  workgroupId: string
  passed: boolean
  failures: string[]
  round: number
  timestamp: string
}

const auditHistory = new Map<string, { round: number; failures: string[] }>()

/**
 * 检查工作组是否全部 task 完成，如果是则触发验收。
 */
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
 * 执行审计验收 — 逐项检查清单。
 * 审计署自身不执行检查（代码级检查归应急部），
 * 它负责收集各部委上报的状态并判定。
 */
export async function runAudit(workgroupId: string): Promise<AuditResult> {
  const history = auditHistory.get(workgroupId) ?? { round: 0, failures: [] }
  history.round++
  auditHistory.set(workgroupId, history)

  // 审计署是 llm agent，由国务院 task() 调用。
  // 此函数提供 agent 所需的上下文和清单参考。
  const checklistSummary = AUDIT_CHECKLIST
    .map((item) => `□ ${item.name} — ${item.description}`)
    .join("\n")

  const result: AuditResult = {
    workgroupId,
    passed: false, // 由 agent 判定后更新
    failures: [],
    round: history.round,
    timestamp: new Date().toISOString(),
  }

  if (history.round >= 3) {
    // 第 3 轮仍不合格 → 已知缺陷放行
    sendMessage(workgroupId, {
      from: "shenjishu",
      to: "guowuyuan",
      kind: "message",
      body: `审计验收第 ${history.round} 轮（最终轮），请按以下清单验收：\n\n${checklistSummary}\n\n不合格项请标记已知缺陷放行，记录到《若干问题》。`,
    })
    updateWorkgroupStatus(workgroupId, "completed")
    runArchiving(workgroupId).catch(() => {})
  } else {
    sendMessage(workgroupId, {
      from: "shenjishu",
      to: "guowuyuan",
      kind: "message",
      body: `审计验收已触发（第 ${history.round}/3 轮），请国务院 spawn shenjishu agent 按以下清单验收：\n\n${checklistSummary}\n\n审计署应 cos 普通用户，按 README 走安装和使用流程，不读代码。`,
    })
  }

  return result
}

export function getAuditHistory(workgroupId: string) {
  return auditHistory.get(workgroupId)
}

export function clearAuditHistory(workgroupId: string) {
  auditHistory.delete(workgroupId)
}
