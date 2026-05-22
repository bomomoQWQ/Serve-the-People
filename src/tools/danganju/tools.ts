/**
 * 档案局 tool definitions — expose archive operations to 档案局 agent.
 *
 * Tools provided:
 *   - danganju_archive  — Archive work report, self-criticism, or red-head document
 *   - danganju_query    — Query the 9-dimension index
 *   - danganju_analyze  — Run cross-pattern analysis and generate《若干问题》draft
 *   - danganju_draft    — Read or list analysis drafts
 *   - danganju_digestion — Mark or check ministry digestion status
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import {
  archiveWorkReport,
  archiveSelfCriticism,
  readArchive,
  listArchivedWorks,
} from "../../features/archives/storage"
import {
  queryIndex,
  rebuildIndex,
  indexRedHeadDocument,
} from "../../features/archives/indices"
import type { IndexQuery, Severity } from "../../features/archives/templates"
import { analyze, listDrafts, readDraft } from "../../features/archives/analysis"
import {
  markDigestion,
  getRedHeadDigestion,
  getAllDigestions,
  getMinistryDigestion,
  getPendingMinistries,
  isDigested,
  markSkillFromRedHead,
} from "../../features/archives/digestion"

export function createDanganjuTools(): Record<string, ToolDefinition> {
  // ─── danganju_archive ───
  const danganjuArchive: ToolDefinition = tool({
    description:
      "归档工作报告、自我批评或红头文件。传入 type 和对应的 JSON 数据。",
    args: {
      type: tool.schema.string()
        .describe("归档类型: work_report, self_criticism, red_head"),
      data: tool.schema.string()
        .describe("JSON 字符串，格式根据 type 不同：\n" +
          "work_report: { workId, title, outputs[{filePath,summary}], timeline[{phase,startTime,endTime,smooth,notes?}], collaborations[{ministry,interaction,hadWaiting}], createdAt }\n" +
          "self_criticism: { workId, problemDescription, rootCause(设计缺陷|低级错误|协作摩擦|标准歧义|外部原因), severity(critical|high|medium|low), improvementSuggestions[], phase, ministry, createdAt }\n" +
          "red_head: { code(国发〔YYYY〕N号), title, content, issuedBy, issuedAt, relatedCategories[] }"),
    },
    execute: async (args) => {
      const type = args.type as string
      const raw = args.data as string

      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(raw) } catch {
        return "错误：data 不是有效的 JSON"
      }

      switch (type) {
        case "work_report": {
          const report = archiveWorkReport(parsed as unknown as Parameters<typeof archiveWorkReport>[0])
          return `✅ 已归档工作报告: ${report.workId} - ${report.title}`
        }
        case "self_criticism": {
          const crit = archiveSelfCriticism(parsed as unknown as Parameters<typeof archiveSelfCriticism>[0])
          return `✅ 已归档自我批评: ${crit.workId} [${crit.severity}] ${crit.rootCause}`
        }
        case "red_head": {
          const entry = indexRedHeadDocument(parsed as unknown as Parameters<typeof indexRedHeadDocument>[0])
          return `✅ 已索引红头文件: ${entry.workId} - ${entry.ministry}`
        }
        default:
          return `错误：未知归档类型 "${type}"，可选: work_report, self_criticism, red_head`
      }
    },
  })

  // ─── danganju_query ───
  const danganjuQuery: ToolDefinition = tool({
    description:
      "查询档案局 9 维索引。9 个维度全部可选，AND 组合过滤。",
    args: {
      task_type: tool.schema.string().optional()
        .describe("① 任务类型"),
      lesson_category: tool.schema.string().optional()
        .describe("② 教训分类"),
      severity: tool.schema.string().optional()
        .describe("③ 严重程度: critical, high, medium, low"),
      ministry: tool.schema.string().optional()
        .describe("④ 涉及部委"),
      red_head_ref: tool.schema.string().optional()
        .describe("⑤ 关联红头文件编号"),
      workgroup_id: tool.schema.string().optional()
        .describe("⑥ 工作组 ID"),
      time_start: tool.schema.string().optional()
        .describe("⑦ 时间范围起始 (ISO 8601)"),
      time_end: tool.schema.string().optional()
        .describe("⑦ 时间范围结束 (ISO 8601)"),
      phase: tool.schema.string().optional()
        .describe("⑧ phase 阶段"),
      full_text_search: tool.schema.string().optional()
        .describe("⑨ 全文搜索关键词"),
      rebuild: tool.schema.boolean().optional()
        .describe("是否先重建索引（默认 false），传入 true 强制刷新"),
    },
    execute: async (args) => {
      if (args.rebuild) rebuildIndex()

      const result = queryIndex({
        taskType: (args.task_type as string) ?? undefined,
        lessonCategory: (args.lesson_category as string) ?? undefined,
        severity: args.severity as Severity | undefined,
        ministry: (args.ministry as string) ?? undefined,
        redHeadRef: (args.red_head_ref as string) ?? undefined,
        workgroupId: (args.workgroup_id as string) ?? undefined,
        timeStart: (args.time_start as string) ?? undefined,
        timeEnd: (args.time_end as string) ?? undefined,
        phase: (args.phase as string) ?? undefined,
        fullTextSearch: (args.full_text_search as string) ?? undefined,
      })

      if (result.length === 0) return "未找到匹配的索引条目。"
      return result.map(e =>
        `- [${e.entryType}] ${e.workId}: ${e.fullText.slice(0, 100)}... (${e.ministry || "无部委"}, ${e.phase || "无阶段"})`
      ).join("\n")
    },
  })

  // ─── danganju_analyze ───
  const danganjuAnalyze: ToolDefinition = tool({
    description:
      "执行全量交叉分析：统计频发教训、阶段卡顿、critical 教训，自动生成《若干问题》草案。返回 pattern flags + 草案路径 + 摘要。",
    args: {},
    execute: async () => {
      const result = analyze()

      const parts = [`## 交叉分析结果 (${result.generatedAt})`, "", result.summary]
      if (result.patterns.length > 0) {
        parts.push("", "### 检测到的模式")
        for (const p of result.patterns) {
          parts.push(`- ${p.suggestion}`)
        }
      }
      if (result.draftPath) {
        parts.push("", `草案已生成: ${result.draftPath}`)
        if (result.draftContent) {
          parts.push("", "---", result.draftContent)
        }
      }

      return parts.join("\n")
    },
  })

  // ─── danganju_draft ───
  const danganjuDraft: ToolDefinition = tool({
    description:
      "读取或列出《若干问题》草案。action: read（指定文件名）或 list（列出全部）。",
    args: {
      action: tool.schema.string()
        .describe("操作: read（读取指定草案）, list（列出全部草案）"),
      file_name: tool.schema.string().optional()
        .describe("文件名（action=read 时需要，从 list 结果中获取）"),
    },
    execute: async (args) => {
      const action = args.action as string
      const fileName = args.file_name as string | undefined

      switch (action) {
        case "list": {
          const drafts = listDrafts()
          if (drafts.length === 0) return "暂无草案。"
          return drafts.map(f => `- ${f}`).join("\n")
        }
        case "read": {
          if (!fileName) return "错误：read 操作需要提供 file_name"
          const content = readDraft(fileName)
          if (!content) return `未找到草案: ${fileName}`
          return content
        }
        default:
          return `错误：未知操作 "${action}"，可选: read, list`
      }
    },
  })

  // ─── danganju_digestion ───
  const danganjuDigestion: ToolDefinition = tool({
    description:
      "追踪或查询各部委对红头文件的学习消化状态。",
    args: {
      action: tool.schema.string()
        .describe("操作: mark（记录消化状态）, check（查询某红头文件全部部委状态）, pending（查未消化部委）, ministry（查某部委全部状态）, all（全部记录）"),
      ministry: tool.schema.string().optional()
        .describe("部委名称（mark/ministry 操作需要）"),
      red_head_code: tool.schema.string().optional()
        .describe("红头文件编号（mark/check/pending 操作需要）"),
      status: tool.schema.string().optional()
        .describe("消化状态: 已接收, 已学习, 已生成skill, 已消化（mark 操作需要）"),
      skill_name: tool.schema.string().optional()
        .describe("生成的 skill 名称（status=已生成skill 时填写）"),
    },
    execute: async (args) => {
      const action = args.action as string
      const ministry = args.ministry as string | undefined
      const redHeadCode = args.red_head_code as string | undefined
      const status = args.status as string | undefined
      const skillName = args.skill_name as string | undefined

      switch (action) {
        case "mark": {
          if (!ministry || !redHeadCode || !status) {
            return "错误：mark 操作需要 ministry, red_head_code, status"
          }
          const validStatuses = ["已接收", "已学习", "已生成skill", "已消化"]
          if (!validStatuses.includes(status)) {
            return `错误：无效状态 "${status}"，可选: ${validStatuses.join(", ")}`
          }
          const entry = markDigestion(
            ministry as Parameters<typeof markDigestion>[0],
            redHeadCode,
            status as Parameters<typeof markDigestion>[2],
            skillName,
          )
          return `✅ ${ministry} 对 ${redHeadCode} 消化状态已更新为: ${entry.status}`
        }
        case "check": {
          if (!redHeadCode) return "错误：check 操作需要 red_head_code"
          const entries = getRedHeadDigestion(redHeadCode)
          if (entries.length === 0) return `${redHeadCode} 暂无消化记录。`
          return entries.map(e =>
            `- ${e.ministry}: ${e.status}${e.skillName ? ` (skill: ${e.skillName})` : ""}${e.digestedAt ? ` @${e.digestedAt}` : ""}`
          ).join("\n")
        }
        case "pending": {
          if (!redHeadCode) return "错误：pending 操作需要 red_head_code"
          const pending = getPendingMinistries(redHeadCode)
          if (pending.length === 0) return `✅ ${redHeadCode} 全部部委已消化。`
          return `以下部委尚未消化 ${redHeadCode}:\n${pending.map(m => `- ${m}`).join("\n")}`
        }
        case "ministry": {
          if (!ministry) return "错误：ministry 操作需要 ministry"
          const entries = getMinistryDigestion(ministry as Parameters<typeof getMinistryDigestion>[0])
          if (entries.length === 0) return `${ministry} 暂无消化记录。`
          return entries.map(e =>
            `- ${e.redHeadCode}: ${e.status}${e.skillName ? ` → ${e.skillName}` : ""}`
          ).join("\n")
        }
        case "all": {
          const entries = getAllDigestions()
          if (entries.length === 0) return "暂无消化记录。"
          return entries.map(e =>
            `- ${e.ministry} / ${e.redHeadCode}: ${e.status}${e.skillName ? ` → ${e.skillName}` : ""}`
          ).join("\n")
        }
        default:
          return `错误：未知操作 "${action}"，可选: mark, check, pending, ministry, all`
      }
    },
  })

  return {
    danganju_archive: danganjuArchive,
    danganju_query: danganjuQuery,
    danganju_analyze: danganjuAnalyze,
    danganju_draft: danganjuDraft,
    danganju_digestion: danganjuDigestion,
  }
}
