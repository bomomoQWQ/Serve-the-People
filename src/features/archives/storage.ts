/**
 * 档案局 — 文件存储层（全局持久）
 * Layout: ~/.servethepeople/archives/works/{workId}/
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { ARCHIVE_ROOT_GLOBAL } from "../../shared/paths"
import type { WorkReport, SelfCriticism } from "./templates"

// ─── 运行时校验 Schema ─────────────────────────────────────────────
// Zod validators matching the type interfaces, used on read to catch corrupted data.

const WorkReportOutputSchema = z.object({
  filePath: z.string(),
  summary: z.string(),
})
const WorkReportTimelineEntrySchema = z.object({
  phase: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable(),
  smooth: z.boolean(),
  notes: z.string().optional(),
})
const WorkReportCollaborationSchema = z.object({
  ministry: z.string(),
  interaction: z.string(),
  hadWaiting: z.boolean(),
})
const WorkReportSchema = z.object({
  workId: z.string(),
  title: z.string(),
  outputs: z.array(WorkReportOutputSchema),
  timeline: z.array(WorkReportTimelineEntrySchema),
  collaborations: z.array(WorkReportCollaborationSchema),
  createdAt: z.string(),
})
const SelfCriticismSchema = z.object({
  workId: z.string(),
  problemDescription: z.string(),
  rootCause: z.enum(["设计缺陷", "低级错误", "协作摩擦", "标准歧义", "外部原因"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  improvementSuggestions: z.array(z.string()),
  phase: z.string(),
  ministry: z.string(),
  createdAt: z.string(),
})

const WORKS_DIR = join(ARCHIVE_ROOT_GLOBAL, "works")

// ─── 懒初始化 ───────────────────────────────────────────────────────

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

function workDir(workId: string): string {
  const dir = join(WORKS_DIR, workId)
  ensureDir(dir)
  return dir
}

// ─── 工作报告 ───────────────────────────────────────────────────────

/** 归档一份工作报告 */
export function archiveWorkReport(report: WorkReport): WorkReport {
  const dir = workDir(report.workId)
  const filePath = join(dir, "work-report.json")
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8")
  return report
}

/** 读取工作报告 */
export function readWorkReport(workId: string): WorkReport | null {
  const filePath = join(WORKS_DIR, workId, "work-report.json")
  if (!existsSync(filePath)) return null
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"))
    return WorkReportSchema.parse(raw) as WorkReport
  } catch {
    return null
  }
}

// ─── 自我批评 ───────────────────────────────────────────────────────

/** 归档一份自我批评 */
export function archiveSelfCriticism(criticism: SelfCriticism): SelfCriticism {
  const dir = workDir(criticism.workId)
  const filePath = join(dir, "self-criticism.json")
  writeFileSync(filePath, JSON.stringify(criticism, null, 2), "utf-8")
  return criticism
}

/** 读取自我批评 */
export function readSelfCriticism(workId: string): SelfCriticism | null {
  const filePath = join(WORKS_DIR, workId, "self-criticism.json")
  if (!existsSync(filePath)) return null
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"))
    return SelfCriticismSchema.parse(raw) as SelfCriticism
  } catch {
    return null
  }
}

// ─── 综合读取 ───────────────────────────────────────────────────────

/** 按 workId 读取完整归档 */
export function readArchive(workId: string): {
  workId: string
  report: WorkReport | null
  criticism: SelfCriticism | null
} {
  return {
    workId,
    report: readWorkReport(workId),
    criticism: readSelfCriticism(workId),
  }
}

// ─── 列出所有已归档工作 ─────────────────────────────────────────────

/** 列出所有已归档的工作 ID */
export function listArchivedWorks(): string[] {
  if (!existsSync(WORKS_DIR)) return []
  try {
    return readdirSync(WORKS_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
  } catch {
    return []
  }
}
