/**
 * 档案局 — 跨任务模式分析
 * 对所有归档教训进行交叉分析，发现系统性问题模式。
 * - 同一分类 ≥ 3 次 → 建议发红头
 * - 同一 phase 高频卡顿 → 建议调整编制
 * - 生成《若干问题》草案 → 写入 .servethepeople/archives/drafts/
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ARCHIVE_ROOT_GLOBAL } from "../../shared/paths"
import { listArchivedWorks, readWorkReport, readSelfCriticism } from "./storage"
import { rebuildIndex } from "./indices"
import type {
  PatternFlag,
  AnalysisResult,
  SelfCriticism,
  WorkReport,
  IndexEntry,
} from "./templates"

const DRAFTS_DIR = join(ARCHIVE_ROOT_GLOBAL, "drafts")

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

// ─── 分析逻辑 ───────────────────────────────────────────────────────

interface CategoryCount {
  category: string
  count: number
  entries: SelfCriticism[]
}

interface PhaseStallCount {
  phase: string
  stallCount: number
  totalCount: number
  workIds: string[]
}

/** 按根因分类统计所有自我批评 */
function countByCategory(works: string[]): CategoryCount[] {
  const map = new Map<string, SelfCriticism[]>()

  for (const workId of works) {
    const crit = readSelfCriticism(workId)
    if (!crit) continue
    const existing = map.get(crit.rootCause) ?? []
    existing.push(crit)
    map.set(crit.rootCause, existing)
  }

  return Array.from(map.entries())
    .map(([category, entries]) => ({
      category,
      count: entries.length,
      entries,
    }))
    .sort((a, b) => b.count - a.count)
}

/** 统计各 phase 的卡顿频率 */
function countPhaseStalls(works: string[]): PhaseStallCount[] {
  const phaseMap = new Map<string, { stalls: number; total: number; workIds: Set<string> }>()

  for (const workId of works) {
    const report = readWorkReport(workId)
    if (!report) continue
    for (const entry of report.timeline) {
      const existing = phaseMap.get(entry.phase) ?? { stalls: 0, total: 0, workIds: new Set() }
      existing.total++
      if (!entry.smooth) existing.stalls++
      existing.workIds.add(workId)
      phaseMap.set(entry.phase, existing)
    }
  }

  return Array.from(phaseMap.entries())
    .map(([phase, data]) => ({
      phase,
      stallCount: data.stalls,
      totalCount: data.total,
      workIds: Array.from(data.workIds),
    }))
    .sort((a, b) => b.stallCount - a.stallCount)
}

/** 收集所有 severity=critical 的新教训（最近一次重建后新增） */
function findNewCriticalLessons(works: string[]): SelfCriticism[] {
  const now = Date.now()
  const windowMs = 7 * 24 * 60 * 60 * 1000 // 最近 7 天
  return works
    .map(id => readSelfCriticism(id))
    .filter((c): c is SelfCriticism =>
      c !== null &&
      c.severity === "critical" &&
      now - new Date(c.createdAt).getTime() < windowMs,
    )
}

// ─── 标记生成 ───────────────────────────────────────────────────────

const RED_HEAD_THRESHOLD = 3

/** 分析同分类频次 → 红头建议 */
function checkRedHeadSuggestions(categories: CategoryCount[]): PatternFlag[] {
  return categories
    .filter(c => c.count >= RED_HEAD_THRESHOLD)
    .map(c => ({
      type: "red_head_suggestion" as const,
      category: c.category,
      count: c.count,
      suggestion: `"${c.category}" 类教训已累积 ${c.count} 次，建议起草《关于"${c.category}"问题的若干问题》红头文件，供各部委学习消化。`,
    }))
}

/** 分析同 phase 卡顿 → 编制调整建议 */
function checkStaffingAdjustments(phaseStalls: PhaseStallCount[]): PatternFlag[] {
  return phaseStalls
    .filter(p => p.stallCount >= RED_HEAD_THRESHOLD && p.stallCount / p.totalCount >= 0.5)
    .map(p => ({
      type: "staffing_adjustment" as const,
      phase: p.phase,
      count: p.stallCount,
      suggestion: `"${p.phase}" 阶段在 ${p.workIds.length} 个工作组中出现 ${p.stallCount} 次卡顿（占比 ${((p.stallCount / p.totalCount) * 100).toFixed(0)}%），建议调整该阶段编制或增加专项 skill 支持。`,
    }))
}

// ─── 生成《若干问题》草案 ───────────────────────────────────────────

function generateDraftContent(
  categories: CategoryCount[],
  phaseStalls: PhaseStallCount[],
  criticals: SelfCriticism[],
  index: IndexEntry[],
): string {
  const lines: string[] = []
  const dateStr = new Date().toISOString().split("T")[0]

  lines.push(`# 《关于"为人民服务"系统的若干问题》`)
  lines.push(`> 生成日期：${dateStr}`)
  lines.push(`> 数据来源：档案局自动分析`)
  lines.push(``)

  // 一、频发教训
  lines.push(`## 一、频发教训（同分类 ≥ ${RED_HEAD_THRESHOLD} 次）`)
  lines.push(``)
  const flagged = categories.filter(c => c.count >= RED_HEAD_THRESHOLD)
  if (flagged.length === 0) {
    lines.push(`当前无达到阈值的频发教训。`)
  } else {
    for (const cat of flagged) {
      lines.push(`### ${cat.category}（${cat.count} 次）`)
      for (const entry of cat.entries.slice(0, 5)) {
        lines.push(`- [${entry.workId}] ${entry.problemDescription}（${entry.phase}）`)
      }
      if (cat.entries.length > 5) {
        lines.push(`- ... 及其他 ${cat.entries.length - 5} 条`)
      }
      lines.push(``)
    }
  }

  // 二、phase 卡顿
  lines.push(`## 二、阶段卡顿分析`)
  lines.push(``)
  const stalled = phaseStalls.filter(p => p.stallCount >= RED_HEAD_THRESHOLD && p.stallCount / p.totalCount >= 0.5)
  if (stalled.length === 0) {
    lines.push(`当前无达到阈值的高频卡顿阶段。`)
  } else {
    for (const ps of stalled) {
      lines.push(`### ${ps.phase}（${ps.stallCount}/${ps.totalCount} 次卡顿）`)
      lines.push(`涉及工作组：${ps.workIds.join("、")}`)
      lines.push(``)
    }
  }

  // 三、critical 教训
  lines.push(`## 三、近期 Critical 级别教训`)
  lines.push(``)
  if (criticals.length === 0) {
    lines.push(`近期无新增 critical 级别教训。`)
  } else {
    for (const c of criticals) {
      lines.push(`- [${c.workId}] ${c.problemDescription}（${c.rootCause}，${c.createdAt}）`)
      lines.push(`  改进建议：${c.improvementSuggestions.join("；")}`)
    }
    lines.push(``)
  }

  // 四、统计摘要
  const totalCriticisms = index.filter(e => e.entryType === "self-criticism").length
  const totalReports = index.filter(e => e.entryType === "work-report").length
  lines.push(`## 四、统计摘要`)
  lines.push(``)
  lines.push(`- 归档工作报告：${totalReports} 份`)
  lines.push(`- 归档自我批评：${totalCriticisms} 份`)
  lines.push(`- 索引条目总数：${index.length}`)
  lines.push(``)

  return lines.join("\n")
}

// ─── 公开 API ───────────────────────────────────────────────────────

/** 执行全量交叉分析 */
export function analyze(): AnalysisResult {
  const works = listArchivedWorks()
  const index = rebuildIndex()

  const categories = countByCategory(works)
  const phaseStalls = countPhaseStalls(works)
  const criticals = findNewCriticalLessons(works)

  const redHeadFlags = checkRedHeadSuggestions(categories)
  const staffingFlags = checkStaffingAdjustments(phaseStalls)
  const flags = [...redHeadFlags, ...staffingFlags]

  const draftContent = generateDraftContent(categories, phaseStalls, criticals, index)
  const fileName = `若干问题的草案-${new Date().toISOString().replace(/[:.]/g, "-")}.md`
  ensureDir(DRAFTS_DIR)
  const draftPath = join(DRAFTS_DIR, fileName)
  writeFileSync(draftPath, draftContent, "utf-8")

  const summaryParts: string[] = []
  if (redHeadFlags.length > 0) {
    summaryParts.push(`发现 ${redHeadFlags.length} 类频发教训建议发红头`)
  }
  if (staffingFlags.length > 0) {
    summaryParts.push(`发现 ${staffingFlags.length} 个阶段高频卡顿建议调整编制`)
  }
  if (criticals.length > 0) {
    summaryParts.push(`${criticals.length} 条新增 critical 教训`)
  }
  if (summaryParts.length === 0) {
    summaryParts.push(`未发现显著模式`)
  }

  return {
    patterns: flags,
    draftContent,
    draftPath,
    generatedAt: new Date().toISOString(),
    summary: summaryParts.join("；"),
  }
}

/** 列出所有已生成的草案 */
export function listDrafts(): string[] {
  if (!existsSync(DRAFTS_DIR)) return []
  try {
    return readdirSync(DRAFTS_DIR)
      .filter(f => f.endsWith(".md"))
      .sort()
      .reverse()
  } catch {
    return []
  }
}

/** 读取指定草案内容 */
export function readDraft(fileName: string): string | null {
  const filePath = join(DRAFTS_DIR, fileName)
  if (!existsSync(filePath)) return null
  try {
    return readFileSync(filePath, "utf-8")
  } catch {
    return null
  }
}
