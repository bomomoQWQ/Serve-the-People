/**
 * 学习系统集成 — 串联第 9-14 步的触发逻辑。
 * 在审计验收通过后自动调用。
 */

import { archiveWorkReport, archiveSelfCriticism } from "../archives/storage"
import { rebuildIndex, queryIndex } from "../archives/indices"
import { analyze } from "../archives/analysis"
import { markDigestion, markSkillFromRedHead } from "../archives/digestion"
import { type WorkReport, type SelfCriticism } from "../archives/templates"
import { sendMessage } from "../workgroup/mailbox"
import { getWorkgroup } from "../workgroup/state"
import type { AuditResult } from "../shenjishu/auto-trigger"

/**
 * 第 9 步：审计通过后，触发各部委写工作报告和自我批评。
 * 实际执行需要各部委 agent 自行完成，这里生成模板提示词。
 */
export function generatePostMortemPrompts(workgroupId: string): string[] {
  const workgroup = getWorkgroup(workgroupId)
  if (!workgroup) return []

  return workgroup.members.map((member: string) => {
    return `[第9步 自我批评]
你作为 ${member}，请对工作组 ${workgroupId} 的本轮工作撰写：

## 工作报告
- 产出清单（文件路径 + 摘要）
- 时间线（每个 phase 的起止和是否顺利）
- 协作记录（与哪些部委交互、是否有等待）

## 自我批评
- 问题描述（具体到文件:行号或 task 编号）
- 根因分类（设计缺陷 / 低级错误 / 协作摩擦 / 标准歧义 / 外部原因）
- 严重程度（critical / high / medium / low）
- 改进建议（自审清单新增 / skill 新增 / 流程改进）

请将结果写入 .servethepeople/archives/works/${workgroupId}/work-report.json 和 self-criticism.json`
  })
}

/**
 * 第 10 步：档案局归档 + 提炼。
 * 将工作报告和自我批评入库、建索引、交叉分析。
 */
export async function runArchiving(workgroupId: string): Promise<string | null> {
  try {
    // 重建九维索引
    rebuildIndex()

    // 交叉分析
    const result = analyze() as unknown as Record<string, unknown>
    const flags = (result.flags ?? []) as Array<Record<string, unknown>>
    if (flags.length > 0) {
      const { mkdirSync, writeFileSync } = await import("node:fs")
      const draftDir = ".servethepeople/archives/drafts"
      mkdirSync(draftDir, { recursive: true })

      const draftContent = generateDraftContent(
        flags.map(f => ({
          type: String(f.type ?? ""),
          category: String(f.category ?? ""),
          phase: String(f.phase ?? ""),
          count: Number(f.count ?? 0),
          suggestion: String(f.suggestion ?? ""),
        })),
        workgroupId,
      )
      const draftPath = `${draftDir}/${workgroupId}-ruogan-wenti.md`
      writeFileSync(draftPath, draftContent, "utf-8")

      // 通知国务院：有《若干问题》草案待审
      sendMessage(workgroupId, {
        from: "danganju",
        to: "guowuyuan",
        kind: "message",
        body: `[第10步] ${flags.length} 项模式已识别，《若干问题》草案已生成：${draftPath}\n请审阅后决定是否签发红头文件。`,
      })

      return draftPath
    }
    return null
  } catch (e) {
    console.warn(`[archives] 归档失败: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

/**
 * 第 11 步：国务院签发红头文件。
 * 这里生成红头文件模板，实际签发由国务院 agent 执行。
 */
export function generateRedHeadDraft(workgroupId: string, category: string, lessons: string[]): string {
  const year = new Date().getFullYear()
  const code = `国发〔${year}〕${String(Math.floor(Math.random() * 99) + 1).padStart(1, "0")}号`

  return `# ${code} 关于${category}工作的通知

## 背景
工作组 ${workgroupId} 在执行过程中出现以下问题：

${lessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}

## 纠正措施

## 抄送
相关部委

---
签发：国务院
日期：${new Date().toISOString().slice(0, 10)}
`
}

/**
 * 第 12-13 步：部委学习转化并跟踪消化状态。
 */
export function simulateMinistryLearning(workgroupId: string, redHeadCode: string): void {
  const workgroup = getWorkgroup(workgroupId)
  if (!workgroup) return

  for (const member of workgroup.members) {
    markDigestion(member as never, redHeadCode, "已接收")
  }

  sendMessage(workgroupId, {
    from: "danganju",
    to: "guowuyuan",
    kind: "message",
    body: `[第12-13步] 红头文件 ${redHeadCode} 已抄送各部委学习。消化状态可通过档案局查询。`,
  })
}

/**
 * 第 14 步：下次任务时预加载技能。
 * 在组建工作组时查询档案局，为相关部委预载对应 Skill。
 */
export function preloadSkillsForTask(taskType: string, ministries: string[]): string[] {
  const results = queryIndex({ taskType } as never)
  const skills: string[] = []

  for (const entry of results.slice(0, 10)) {
    if (ministries.includes(entry.ministry)) {
      skills.push(`skill: ${entry.lessonCategory} (from ${entry.redHeadRef || "direct experience"})`)
    }
  }

  return skills
}

/** 生成《若干问题》草稿内容 */
function generateDraftContent(flags: Array<Record<string, unknown>>, workgroupId: string): string {
  const lines = [`# 关于工作组 ${workgroupId} 的若干问题`, "", "## 发现问题", ""]

  for (const flag of flags) {
    lines.push(`### ${flag.type === "red_head_suggestion" ? "频发教训" : "phase 卡顿"}`)
    lines.push(`- 分类/阶段：${flag.category || flag.phase || "未知"}`)
    lines.push(`- 出现次数：${flag.count}`)
    lines.push(`- 建议：${flag.suggestion}`)
    lines.push("")
  }

  lines.push("## 建议", "", "建议国务院签批发红头文件，抄送相关部委学习。")
  return lines.join("\n")
}
