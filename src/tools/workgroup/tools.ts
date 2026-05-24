/**
 * 工作组 tool definitions — expose workgroup management to agents.
 *
 * Tools provided:
 *   - workgroup_create  — Create a new workgroup and spawn member agents
 *   - workgroup_status  — Get status of a workgroup
 *   - workgroup_list    — List all active workgroups
 *   - stp_workgroup_task    — Assign a task within a workgroup
 *   - stp_workgroup_message — Send a message to a workgroup member
 *   - workgroup_disband — Cleanup workgroup temp data
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"
import { TaskManager } from "../delegate-task/task-manager"
import {
  createWorkgroup,
  getWorkgroup,
  updateWorkgroupStatus,
} from "../../features/workgroup/state"
import {
  createTask,
  listTasks,
  getTask,
  claimTask,
  updateTask,
} from "../../features/workgroup/tasklist"
import { sendMessage, pollInbox } from "../../features/workgroup/mailbox"
import { ackMessage } from "../../features/workgroup/mailbox"
import { registerSession, findSessionByMember } from "../../features/workgroup/session-registry"

/**
 * Create all workgroup-related tools.
 * Uses real file I/O for state, tasklist, and mailbox persistence.
 */
export function createWorkgroupTools(ctx: PluginInput): Record<string, ToolDefinition> {
  const manager = new TaskManager(ctx.client)
  const client = ctx.client

  // ─── workgroup_create — spawn a new workgroup ───
  const workgroupCreate: ToolDefinition = tool({
    description:
      "创建工作组并 spawn 成员 Agent。传入 teamId、名称、方案和成员列表，系统将为每个成员创建 task、发送邮箱通知并启动子 Agent 会话。",
    args: {
      team_id: tool.schema.string()
        .describe("工作组ID（唯一标识）"),
      name: tool.schema.string()
        .describe("工作组名称"),
      plan: tool.schema.string()
        .describe("执行方案（Markdown）"),
      members: tool.schema.array(
        tool.schema.object({
          agent: tool.schema.string().describe("Agent 名称（如 gongxinbu, yingjibu）"),
          role: tool.schema.string().describe("成员角色"),
          task: tool.schema.string().describe("分配给该成员的任务描述"),
          description: tool.schema.string().optional().describe("详细说明"),
        }),
      ).describe("成员列表"),
    },
    execute: async (args, context) => {
      const teamId = args.team_id as string
      const name = (args.name as string) ?? teamId
      const plan = args.plan as string
      const members = (args.members as Array<Record<string, unknown>>) ?? []
      // Persist workgroup state
      const workgroup = createWorkgroup(
        teamId,
        name,
        members.map((m) => m.agent as string),
        plan,
      )

      const results: string[] = []
      const errors: string[] = []

      for (const member of members) {
        const agent = member.agent as string
        const role = member.role as string
        const memberTask = member.task as string
        const description = member.description as string | undefined

        // Create task in shared tasklist
        const created = createTask(teamId, memberTask, [], description)

        // Send mailbox notification
        sendMessage(teamId, {
          from: "workgroup_create",
          to: agent,
          kind: "message",
          body: JSON.stringify({ task: memberTask, description, taskId: created.id, teamId, role }),
        })

        // Launch sub-agent session (async, real session creation)
        try {
          const result = await manager.launchAsync({
            agent,
            prompt: buildWorkgroupPrompt(agent, role, memberTask, description, name, teamId, created.id, plan),
            description: `${agent}: ${memberTask}`,
          })

          if (result.status === "error") {
            errors.push(`❌ ${agent} (${role}): ${result.error}`)
          } else {
            // Register session for mailbox injection + idle-wake
            registerSession(result.sessionId, {
              teamId,
              agent,
              memberName: `${agent}:${role}`,
            })
            results.push(`✅ ${agent} (${role}): task=${created.id} session=${result.sessionId.slice(0, 8)}`)
          }
        } catch (e) {
          errors.push(`❌ ${agent} (${role}): ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      // Update workgroup status
      if (errors.length === members.length) {
        updateWorkgroupStatus(teamId, "failed")
      }

      // Register 国务院 itself as a workgroup member (no auto-injection)
      const ctx = context as Record<string, unknown>
      const callerSessionId = (ctx.sessionID ?? ctx.session_id ?? "") as string
      if (callerSessionId) {
        registerSession(callerSessionId, { teamId, agent: "guowuyuan", memberName: "guowuyuan:国务院" })
      }

      return [
        `## 工作组「${name}」`,
        `ID: ${workgroup.teamId}`,
        `状态: ${workgroup.status}`,
        "",
        "### 成员启动结果",
        ...results,
        ...(errors.length > 0 ? ["", "### 错误", ...errors] : []),
      ].join("\n")
    },
  })

  // ─── workgroup_status — query workgroup state ───
  const workgroupStatus: ToolDefinition = tool({
    description:
      "查询指定工作组的状态，包括成员、任务进度等信息。",
    args: {
      team_id: tool.schema.string()
        .describe("工作组ID"),
    },
    execute: async (args) => {
      const teamId = args.team_id as string
      const state = getWorkgroup(teamId)
      if (!state) {
        return `未找到工作组: ${teamId}`
      }

      const tasks = listTasks(teamId)
      const taskSummary = tasks.map((t) =>
        `- [${t.status}] ${t.subject} ${t.owner ? `(${t.owner})` : ""} ${t.blockedBy.length > 0 ? `阻塞: ${t.blockedBy.join(", ")}` : ""}`,
      ).join("\n")

      return [
        `## 工作组: ${state.name}`,
        `ID: ${state.teamId}`,
        `状态: ${state.status}`,
        `成员: ${state.members.join(", ")}`,
        `创建: ${state.createdAt}`,
        `更新: ${state.updatedAt}`,
        "",
        `### 任务列表 (${tasks.length})`,
        taskSummary || "(无任务)",
      ].join("\n")
    },
  })

  // ─── workgroup_list — list all workgroups ───
  const workgroupList: ToolDefinition = tool({
    description:
      "列出所有活跃的工作组。",
    args: {
      status_filter: tool.schema.string().optional()
        .describe("按状态过滤: creating, active, completed, failed"),
    },
    execute: async (args) => {
      const statusFilter = args.status_filter as string | undefined

      const { readdirSync, existsSync, readFileSync } = await import("node:fs")
      const { join } = await import("node:path")

      const teamsDir = ".servethepeople/teams"
      if (!existsSync(teamsDir)) {
        return "未找到任何工作组（.servethepeople/teams/ 目录不存在）。"
      }

      const entries = readdirSync(teamsDir, { withFileTypes: true })
      const workgroups: string[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith(".")) continue

        const stateFile = join(teamsDir, entry.name, "state.json")
        if (!existsSync(stateFile)) continue

        try {
          const raw = readFileSync(stateFile, "utf-8")
          const stateObj = JSON.parse(raw) as Record<string, unknown>
          const status = stateObj.status as string

          if (statusFilter && status !== statusFilter) continue

          const name = (stateObj.name ?? entry.name) as string
          const members = stateObj.members as string[]
          workgroups.push(
            `- ${name} (${entry.name}): ${status} — 成员: ${members.join(", ")}`,
          )
        } catch {
          workgroups.push(`- ${entry.name}: (读取失败)`)
        }
      }

      return workgroups.length > 0
        ? `## 工作组列表\n\n${workgroups.join("\n")}`
        : "没有找到工作组" + (statusFilter ? `（状态: ${statusFilter}）` : "")
    },
  })

  // ─── stp_workgroup_task — task management ───
  const workgroupTask: ToolDefinition = tool({
    description:
      "管理工作组内的任务：查看、认领、更新状态。",
    args: {
      team_id: tool.schema.string()
        .describe("工作组ID"),
      action: tool.schema.string()
        .describe("操作: list, get, claim, update"),
      task_id: tool.schema.string().optional()
        .describe("任务ID（get/claim/update 操作需要）"),
      owner: tool.schema.string().optional()
        .describe("认领人（claim 操作需要）"),
      status: tool.schema.string().optional()
        .describe("新状态: pending, claimed, in_progress, completed（update 操作需要）"),
    },
    execute: async (args) => {
      const teamId = args.team_id as string
      const action = args.action as string
      const taskId = args.task_id as string | undefined
      const owner = args.owner as string | undefined
      const status = args.status as string | undefined

      switch (action) {
        case "list": {
          const tasks = listTasks(teamId)
          if (tasks.length === 0) return "该工作组没有任务。"
          return tasks.map((t) =>
            `- [${t.status}] ${t.id}: ${t.subject} ${t.owner ? `(${t.owner})` : "未认领"} ${t.blockedBy.length > 0 ? `阻塞: ${t.blockedBy.join(",")}` : ""}`,
          ).join("\n")
        }
        case "get": {
          if (!taskId) return "错误：需要提供 task_id"
          const task = getTask(teamId, taskId)
          if (!task) return `未找到任务: ${taskId}`
          return [
            `任务: ${task.subject}`,
            `ID: ${task.id}`,
            `状态: ${task.status}`,
            `负责人: ${task.owner ?? "未认领"}`,
            `阻塞: ${task.blockedBy.length > 0 ? task.blockedBy.join(", ") : "无"}`,
            `描述: ${task.description ?? "无"}`,
            `创建: ${task.createdAt}`,
            `更新: ${task.updatedAt}`,
          ].join("\n")
        }
        case "claim": {
          if (!taskId) return "错误：需要提供 task_id"
          if (!owner) return "错误：需要提供 owner（认领人）"
          const claimed = claimTask(teamId, taskId, owner)
          if (!claimed) return `无法认领任务 ${taskId}（可能已被认领或阻塞条件不满足）`
          return `✅ 已认领任务 ${taskId}，负责人: ${owner}`
        }
        case "update": {
          if (!taskId) return "错误：需要提供 task_id"
          if (!status) return "错误：需要提供 status"
          const validStatuses = ["pending", "claimed", "in_progress", "completed"]
          if (!validStatuses.includes(status)) {
            return `错误：无效状态 "${status}"，有效值: ${validStatuses.join(", ")}`
          }
          const updated = updateTask(teamId, taskId, status as "pending" | "claimed" | "in_progress" | "completed")
          if (!updated) return `未找到任务: ${taskId}`
          return `✅ 任务 ${taskId} 状态已更新为 ${status}`
        }
        default:
          return `错误：无效操作 "${action}"，有效值: list, get, claim, update`
      }
    },
  })

  // ─── stp_workgroup_message — inter-member messaging ───
  const workgroupMessage: ToolDefinition = tool({
    description:
      "向工作组成员发送邮件消息，或查看收件箱。",
    args: {
      team_id: tool.schema.string()
        .describe("工作组ID"),
      action: tool.schema.string()
        .describe("操作: send, poll"),
      to: tool.schema.string().optional()
        .describe("收件人 Agent 名称（send 操作需要）"),
      body: tool.schema.string().optional()
        .describe("消息正文（send 操作需要）"),
    },
    execute: async (args) => {
      const teamId = args.team_id as string
      const action = args.action as string
      const to = args.to as string | undefined
      const body = args.body as string | undefined

      switch (action) {
        case "send": {
          if (!to) return "错误：需要提供收件人 to"
          if (!body) return "错误：需要提供消息正文 body"
          const msg = sendMessage(teamId, {
            from: "stp_workgroup_message_tool",
            to,
            kind: "message",
            body,
          })
          // Actively wake the recipient session
          const recipientSid = findSessionByMember(teamId, to)
          if (recipientSid) {
            const api = client.session as unknown as { prompt?: Function }
            api.prompt?.({ path: { id: recipientSid }, body: { agent: to, parts: [{ type: "text", text: `你有新的工作组消息。` }] } }).catch(() => {})
          }
          return `✅ 消息已发送: ${msg.messageId} → ${to}`
        }
        case "poll": {
          if (!to) return "错误：需要提供收件人 to（查询谁的邮箱）"
          const messages = pollInbox(teamId, to)
          if (messages.length === 0) return `${to} 的邮箱为空。`
          // Ack all read messages
          for (const m of messages) {
            ackMessage(teamId, to, m.messageId)
          }
          return messages.map((m) =>
            `- [${m.messageId}] 来自 ${m.from}: ${m.body.slice(0, 120)}${m.body.length > 120 ? "..." : ""} (${m.timestamp})`,
          ).join("\n")
        }
        default:
          return `错误：无效操作 "${action}"，有效值: send, poll`
      }
    },
  })

  // ─── workgroup_disband — cleanup workgroup on completion ───
  const workgroupDisband: ToolDefinition = tool({
    description:
      "解散工作组并清理项目级临时数据（状态/任务/邮箱/审计记录）。保留全局 archives 和 skills。",
    args: {
      team_id: tool.schema.string()
        .describe("工作组 ID"),
    },
    execute: async (args) => {
      const teamId = args.team_id as string
      const { cleanupWorkgroup } = await import("../../features/workgroup/state")
      const cleaned = cleanupWorkgroup(teamId)
      if (cleaned) {
        return `✅ 工作组 ${teamId} 已解散，临时数据已清理。archives 和 skills 不受影响。`
      }
      return `未找到工作组 ${teamId}，可能已被清理。`
    },
  })

  return {
    stp_workgroup_create: workgroupCreate,
    stp_workgroup_status: workgroupStatus,
    stp_workgroup_list: workgroupList,
    stp_stp_workgroup_task: workgroupTask,
    stp_stp_workgroup_message: workgroupMessage,
    stp_workgroup_disband: workgroupDisband,
  }
}

/** Build prompt for spawned workgroup members */
function buildWorkgroupPrompt(
  agent: string,
  role: string,
  memberTask: string,
  description: string | undefined,
  workgroupName: string,
  teamId: string,
  taskId: string,
  plan: string,
): string {
  return [
    `你已被分配到工作组「${workgroupName}」。`,
    `Agent: ${agent}`,
    `角色: ${role}`,
    `任务: ${memberTask}`,
    description ? `详细说明: ${description}` : "",
    "",
    `团队ID: ${teamId}`,
    `任务ID: ${taskId}`,
    "",
    "## 工作组模式",
    "你是工作组的长活成员。消息通过 mailbox 自动投递，idle 时自动唤醒。",
    "",
    "### 操作步骤",
    "1. 认领任务：用 stp_workgroup_task(action=\"claim\", task_id=\"...\") 认领分配给你的任务",
    "2. 执行任务：完成编码/测试/部署等实际工作",
    "3. 报告结果：用 stp_workgroup_message(to=\"协调者\", body=\"结果\") 发送工作成果",
    "4. 标记完成：用 stp_workgroup_task(action=\"update\", task_id=\"...\", status=\"completed\")",
    "5. 等国务院通知：不要自己主动写报告。等国务院 stp_workgroup_message 通知后再提交。",
    "   报告标题《{部委}对{taskId}的工作报告与自我批评》：",
    "   ## 一、工作报告 — 产出清单 / 时间线 / 协作记录",
    "   ## 二、自我批评 — 问题描述 / 根因 / 严重程度 / 改进建议",
    "   写完 stp_workgroup_message 发给国务院。**禁止自行调 stp_danganju 归档**。",
    "",
    "6. 收到红头文件后学习内容，提炼为 skill（stp_skill_write），",
    "   学习报告标题《{部委}关于国发〔YYYY〕N号文件的学习与 skill 提炼报告》。",
    "   如方案中附有红头代号，可用 stp_danganju_digestion(ministry) 自查本部门历史学习报告。",
    "7. 等待解散：全部部委消化完成后，国务院会解散工作组",
    "",
    "### 规则",
    "- **消息时效**：消息带时间戳。超过 2 分钟的先 stp_workgroup_status 查状态再决定",
    "- **节拍等待**：发出请求后必须 idle 等回复，不跳过等待直接干下一步",
    "- **不乱跑**：验收通过后等国务院通知才写报告",
    "- 被退回时根据反馈修改，不要重新开始",
    "- 不要主动退出，你是长活会话",
    "- 不要越权操作其他成员的任务",
    "",
    "---",
    "## 执行方案",
    plan,
  ].filter(Boolean).join("\n")
}
