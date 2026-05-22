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
        teamId,
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
    "1. 认领任务：用 stp_workgroup_task(action=\"claim\", task_id=\"...\") 认领分配给你的任务",
    "2. 执行任务：完成编码/测试/部署等实际工作",
    "3. 报告结果：用 stp_workgroup_message(to=\"协调者\", body=\"结果\") 发送工作成果",
    "4. 标记完成：用 stp_workgroup_task(action=\"update\", task_id=\"...\", status=\"completed\")",
    "5. 验收通过后：提交工作报告和自我批评，用 stp_workgroup_message 发给协调者",
    "   （报告格式：做了什么、踩了什么坑、什么教训、什么改进建议）",
    "6. 学习红头：收到红头文件后学习内容，提炼为 skill，用 stp_workgroup_message 报告消化完成",
    "7. 等待解散：全部部委消化完成后，国务院会解散工作组",
    "",
    "### 规则",
    "- 收到新消息时先读内容再操作",
    "- 被退回时根据反馈修改，不要重新开始",
    "- 不要主动退出，你是长活会话",
    "- 不要越权操作其他成员的任务",
    "- 验收通过后不要退出 —— 还有报告+学习步骤",
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
