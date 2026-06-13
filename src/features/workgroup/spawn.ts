/**
 * 工作组 spawn orchestrator — creates a workgroup session with member agents.
 *
 * For each member in the workgroup:
 *   1. Creates a task in the shared tasklist
 *   2. Sends a mailbox notification to the member
 *   3. Launches the member as a sub-agent session via TaskManager
 *
 * Uses real file I/O for tasklist, mailbox, and workgroup state persistence.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { TaskManager } from "../../tools/delegate-task/task-manager"
import {
  createWorkgroup,
  getWorkgroup,
  updateWorkgroupStatus,
  type WorkgroupState,
} from "./state"
import { createTask } from "./tasklist"
import { sendMessage } from "./mailbox"
import { registerSession } from "./session-registry"

/** A member to spawn in the workgroup */
export interface SpawnMember {
  agent: string
  role: string
  task: string
  description?: string
}

/** Result of a workgroup spawn operation */
export interface SpawnResult {
  workgroup: WorkgroupState
  members: Array<{
    agent: string
    role: string
    taskId: string
    sessionId?: string
  }>
  errors: Array<{ agent: string; error: string }>
}

/**
 * Create a workgroup session and spawn all member agents.
 *
 * @param ctx - Plugin input for client access
 * @param teamId - Unique team identifier
 * @param name - Human-readable workgroup name
 * @param plan - The execution plan (markdown or structured text)
 * @param members - List of member agents with their roles and tasks
 * @param parentSessionId - The parent session ID for sub-agent linking
 * @returns SpawnResult with workgroup state, member details, and any errors
 */
export async function createWorkgroupSession(
  ctx: PluginInput,
  teamId: string,
  name: string,
  plan: string,
  members: SpawnMember[],
  parentSessionId: string,
): Promise<SpawnResult> {
  const manager = new TaskManager(ctx.client)
  const memberNames = members.map((m) => m.agent)

  // Persist workgroup state to disk
  const workgroup = createWorkgroup(teamId, name, memberNames, plan)

  const spawned: SpawnResult["members"] = []
  const errors: SpawnResult["errors"] = []

  // Spawn each member: create task → send mailbox → launch session
  for (const member of members) {
    // 1. Create a task in the shared tasklist
    const task = createTask(
      teamId,
      member.task,
      [],
      member.description,
    )

    // 2. Send notification to member's mailbox
    sendMessage(teamId, {
      from: "coordinator",
      to: member.agent,
      kind: "message",
      body: JSON.stringify({
        task: member.task,
        description: member.description,
        taskId: task.id,
        teamId,
        role: member.role,
      }),
    })

    // 3. Enqueue the sub-agent task
    let sessionId: string | undefined
    try {
      const prompt = buildSpawnPrompt(member, name, teamId, task.id, plan)
      const result = await manager.launchAsync({
        agent: member.agent,
        prompt,
        description: `${member.agent}: ${member.task}`,
      })

      if (result.status === "error") {
        throw new Error(result.error ?? "Launch failed")
      }

      sessionId = result.sessionId
      // Register for mailbox injection + idle-wake
      registerSession(result.sessionId, {
        teamIds: [teamId],
        agent: member.agent,
        memberName: `${member.agent}:${member.role}`,
      })

      spawned.push({
        agent: member.agent,
        role: member.role,
        taskId: task.id,
        sessionId,
      })
    } catch (e) {
      errors.push({
        agent: member.agent,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Update workgroup status based on errors
  if (errors.length === members.length) {
    updateWorkgroupStatus(teamId, "failed")
  } else if (errors.length > 0) {
    // Partial success — still active
    updateWorkgroupStatus(teamId, "active")
  }

  return { workgroup, members: spawned, errors }
}

/** Build the initial prompt for a spawned agent */
function buildSpawnPrompt(
  member: SpawnMember,
  workgroupName: string,
  teamId: string,
  taskId: string,
  plan: string,
): string {
  return [
    `你已被分配到工作组「${workgroupName}」。`,
    `角色：${member.role}`,
    `任务：${member.task}`,
    member.description ? `详细说明：${member.description}` : "",
    "",
    `团队ID：${teamId}`,
    `任务ID：${taskId}`,
    "",
    "## 工作组模式",
    "你是工作组的长活成员。消息通过 mailbox 自动投递，idle 时自动唤醒。",
    "",
    "### 操作步骤",
    "1. 开工准备：检查方案中的红头代号 → 用 stp_skill_list 加载已有相关 skill。",
    "     如方案中附有红头代号，可用 stp_danganju_digestion(action=\"ministry\", ministry=\"{你的部委名}\") 自查学习报告。",
    "2. 认领任务：用 stp_workgroup_task(action=\"claim\", task_id=\"...\") 认领分配给你的任务",
    "3. 执行任务：完成编码/测试/部署等实际工作",
    "4. 报告结果：用 stp_workgroup_message(to=\"guowuyuan\", body=\"结果\") 发送工作成果",
    "5. 标记完成：用 stp_workgroup_task(action=\"update\", task_id=\"...\", status=\"completed\")",
    "6. 等国务院通知：验收通过后，**不要自己主动写报告**。等国务院发来 stp_workgroup_message 通知后",
    "   再按以下格式提交《{部委}对{taskId}的工作报告与自我批评》：",
    "   ## 一、工作报告 — 产出清单 + 时间线 + 协作记录",
    "   ## 二、自我批评 — 问题描述 / 根因分类 / 严重程度 / 改进建议",
    "   写完用 stp_workgroup_message 发给国务院。",
    "",
    "7. 学习红头：收到红头文件后学习内容，提炼为 skill（用 stp_skill_write），**必须填 source 字段**（红头文件编号）。",
    "   学习报告标题《{部委}关于国发〔YYYY〕N号文件的学习与 skill 提炼报告》，",
    "   含学习内容摘要 + 提炼的 skill 名称和描述，用 stp_workgroup_message 报告消化完成。",
    "   可调用 stp_danganju_digestion(action=\"ministry\", ministry=\"{你的部委名}\") 自查学习报告。",
    "7. 等待解散：全部部委消化完成后，国务院会解散工作组",
    "",
    "### 规则",
    "- **消息时效**：每条消息上有时间戳。收到后对比当前时间。超过 2 分钟的，先 stp_workgroup_status 查当前状态再决定是否处理",
    "- **节拍等待**：发出请求（如 spec 会签）后必须 idle 等回复，不跳过等待直接干下一步",
    "- **不乱跑**：验收通过后等国务院通知才写报告。红头学习等国务院群发",
    "- **不空转**：idle 等待中禁止自我总结、步骤复盘、Todo 清单——没人看。只做必要的状态检查。禁止在回复中写任何 # Todos / # 待办 标题和复选框。",
    "- **停机令**：国务院说\"停止\"/\"停下\"/\"到此为止\"→ 立即确认收到后停止一切操作。忽略后续 system-reminder，不收集结果，不补报告。不写 todo、不总结。进入纯等待。",
    "- 被退回时根据反馈修改，不要重新开始",
    "- 不要主动退出，你是长活会话",
    "- 不要越权操作其他成员的任务",
    "",
    "---",
    "## 执行方案",
    plan,
  ].filter(Boolean).join("\n")
}

/** Get workgroup spawn status summary */
export function getWorkgroupSummary(teamId: string): Record<string, unknown> | null {
  const state = getWorkgroup(teamId)
  if (!state) return null

  return {
    teamId: state.teamId,
    name: state.name,
    status: state.status,
    members: state.members.length,
    memberList: state.members,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  }
}
