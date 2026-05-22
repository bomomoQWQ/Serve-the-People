/**
 * 审计署自动验收触发器。
 * 当工作组全部 task 完成时触发验收，按清单逐项检查，
 * 通过/退回（最多 3 轮），结果写入国务院 mailbox。
 */

import { listTasks, type Task } from "../workgroup/tasklist"
import { getWorkgroup, updateWorkgroupStatus } from "../workgroup/state"
import { CHECKLIST, type AuditContext, type CheckResult } from "./checklist-defs"
import { sendMessage } from "../workgroup/mailbox"
import { runArchiving } from "../pipeline/learning"

export interface AuditResult {
  workgroupId: string
  passed: boolean
  results: Record<string, CheckResult>
  round: number
  timestamp: string
}

/** 存储审计记录，用于追踪退回轮数 */
const auditHistory = new Map<string, { round: number; failures: string[] }>()

/**
 * 检查工作组是否全部 task 完成，如果是则触发验收。
 * 应在每次 task 状态更新后调用。
 */
export async function tryTriggerAudit(workgroupId: string): Promise<AuditResult | null> {
  const workgroup = getWorkgroup(workgroupId)
  if (!workgroup || workgroup.status !== "active") return null

  const tasks = listTasks(workgroupId)
  if (tasks.length === 0) return null

  // 检查是否全部完成
  const allDone = tasks.every((t: Task) => t.status === "completed")
  if (!allDone) return null

  // 触发验收
  return await runAudit(workgroupId, tasks)
}

/**
 * 执行审计验收。
 */
export async function runAudit(workgroupId: string, tasks: Task[]): Promise<AuditResult> {
  const history = auditHistory.get(workgroupId) ?? { round: 0, failures: [] }
  history.round++
  auditHistory.set(workgroupId, history)

  const context: AuditContext = {
    workgroupId,
    codeFiles: tasks.map((t: Task) => t.subject).filter((s: string) => s.includes(".ts") || s.includes(".js")),
    specPath: undefined, // 实际情况中应由工信部上报
    dockerfilePath: undefined,
    docsPath: undefined,
  }

  // 逐项检查
  const results: Record<string, CheckResult> = {}
  let allPassed = true

  for (const item of CHECKLIST) {
    const result = await item.check(context)
    results[item.id] = result
    if (!result.passed) {
      allPassed = false
      history.failures.push(`${item.name}: ${result.detail}`)
    }
  }

  const auditResult: AuditResult = {
    workgroupId,
    passed: allPassed,
    results,
    round: history.round,
    timestamp: new Date().toISOString(),
  }

  if (allPassed) {
    // 通过 → 通知国务院
    updateWorkgroupStatus(workgroupId, "completed")
    sendMessage(workgroupId, {
      from: "shenjishu",
      to: "guowuyuan",
      kind: "message",
      body: `验收通过（第 ${history.round} 轮）。工作组成果已验收完毕。`,
    })

    // 第 9-10 步：触发学习系统 — 归档 + 交叉分析
    runArchiving(workgroupId).catch((e) => {
      console.warn(`[learning] 归档失败: ${String(e)}`)
    })
  } else if (history.round >= 3) {
    // 第 3 轮仍不合格 → 已知缺陷放行
    sendMessage(workgroupId, {
      from: "shenjishu",
      to: "guowuyuan",
      kind: "message",
      body: `验收第 ${history.round} 轮，以下项仍不合格，已标记已知缺陷放行：\n${history.failures.join("\n")}\n\n请将上述问题记录到《若干问题》。`,
    })
    updateWorkgroupStatus(workgroupId, "completed")

    // 触发学习系统 — 已知缺陷也归档
    runArchiving(workgroupId).catch((e) => {
      console.warn(`[learning] 归档失败: ${String(e)}`)
    })
  } else {
    // 不合格 → 退回
    const failureList = history.failures.slice(-10).map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")
    sendMessage(workgroupId, {
      from: "shenjishu",
      to: "guowuyuan",
      kind: "message",
      body: `验收未通过（第 ${history.round}/3 轮）：\n${failureList}\n\n请整改后重新提交。`,
    })
  }

  return auditResult
}

/** 获取审计历史 */
export function getAuditHistory(workgroupId: string) {
  return auditHistory.get(workgroupId)
}

/** 清理审计记录 */
export function clearAuditHistory(workgroupId: string) {
  auditHistory.delete(workgroupId)
}
