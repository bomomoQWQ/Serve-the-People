/**
 * 审计署自动验收触发器。
 * 当工作组全部 task 完成时触发验收通知。
 *
 * 审计署是 task() 一次性调用（非长活），由国务院在收到触发通知后
 * 调用 task(subagent_type="shenjishu") 执行验收。出审计报告，不生成《若干问题》。
 */

import { listTasks, type Task } from "../workgroup/tasklist"
import { getWorkgroup, updateWorkgroupStatus } from "../workgroup/state"
import { AUDIT_CHECKLIST } from "./checklist-defs"
import { sendMessage } from "../workgroup/mailbox"

export interface AuditResult {
  workgroupId: string
  passed: boolean
  failures: string[]
  round: number
  timestamp: string
}

const auditHistory = new Map<string, { round: number; failures: string[] }>()

/**
 * 检查工作组是否全部 task 完成，如果是则触发验收通知。
 * 通知发给国务院，由国务院 task(shenjishu) 执行实际验收。
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
 * 发送验收触发通知给国务院。
 */
export async function runAudit(workgroupId: string): Promise<AuditResult> {
  const history = auditHistory.get(workgroupId) ?? { round: 0, failures: [] }
  history.round++
  auditHistory.set(workgroupId, history)

  const checklistSummary = AUDIT_CHECKLIST
    .map((item) => `□ ${item.name} — ${item.description}`)
    .join("\n")

  if (history.round >= 3) {
    updateWorkgroupStatus(workgroupId, "completed")
  }

  sendMessage(workgroupId, {
    from: "shenjishu",
    to: "guowuyuan",
    kind: "message",
    body: [
      `审计验收触发（第 ${history.round}/3 轮）`,
      "请国务院调用 task(subagent_type=\"shenjishu\") 执行验收。",
      "审计署应 cos 普通用户按 README 走流程，出审计报告，不读代码。",
      history.round >= 3 ? "此为最终轮，不合格项标记已知缺陷放行。" : "",
      "",
      "### 验收清单",
      checklistSummary,
    ].filter(Boolean).join("\n"),
  })

  return {
    workgroupId,
    passed: false,
    failures: [],
    round: history.round,
    timestamp: new Date().toISOString(),
  }
}

export function getAuditHistory(workgroupId: string) {
  return auditHistory.get(workgroupId)
}

export function clearAuditHistory(workgroupId: string) {
  auditHistory.delete(workgroupId)
}
