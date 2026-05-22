/**
 * 档案局 — 9 维索引
 * 构建、存储、查询 9 维度索引。
 * Layout: .servethepeople/archives/indices/index.json
 *
 * 9 个维度：
 * ① 任务类型    ② 教训分类    ③ 严重程度
 * ④ 涉及部委    ⑤ 关联红头    ⑥ 工作组 ID
 * ⑦ 时间范围    ⑧ phase 阶段  ⑨ 全文搜索
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { readWorkReport, readSelfCriticism, listArchivedWorks } from "./storage"
import type { IndexEntry, IndexQuery, SelfCriticism, WorkReport, RedHeadDocument } from "./templates"

const ARCHIVE_ROOT = ".servethepeople/archives"
const INDICES_DIR = join(ARCHIVE_ROOT, "indices")
const INDEX_FILE = join(INDICES_DIR, "index.json")

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

// ─── 构建索引条目 ───────────────────────────────────────────────────

function buildEntryFromReport(report: WorkReport): IndexEntry {
  const timelineText = report.timeline
    .map(t => `[${t.phase}] ${t.smooth ? "顺利" : "卡顿"} ${t.startTime} → ${t.endTime ?? "进行中"}`)
    .join("\n")
  const collabText = report.collaborations
    .map(c => `${c.ministry}: ${c.interaction}${c.hadWaiting ? " (等待)" : ""}`)
    .join("\n")
  const outputText = report.outputs.map(o => `${o.filePath}: ${o.summary}`).join("\n")

  const phases = report.timeline.map(t => t.phase)
  const times = report.timeline.map(t => t.startTime).sort()

  return {
    workId: report.workId,
    entryType: "work-report",
    taskType: "",
    lessonCategory: "",
    severity: "",
    ministry: "",
    redHeadRef: "",
    workgroupId: report.workId,
    timeStart: times[0] ?? report.createdAt,
    timeEnd: times[times.length - 1] ?? report.createdAt,
    phase: phases.join(", "),
    fullText: [report.title, timelineText, collabText, outputText].join("\n"),
  }
}

function buildEntryFromCriticism(criticism: SelfCriticism): IndexEntry {
  return {
    workId: criticism.workId,
    entryType: "self-criticism",
    taskType: "",
    lessonCategory: criticism.rootCause,
    severity: criticism.severity,
    ministry: criticism.ministry,
    redHeadRef: "",
    workgroupId: criticism.workId,
    timeStart: criticism.createdAt,
    timeEnd: criticism.createdAt,
    phase: criticism.phase,
    fullText: [criticism.problemDescription, criticism.rootCause, ...criticism.improvementSuggestions].join("\n"),
  }
}

function buildEntryFromRedHead(doc: RedHeadDocument): IndexEntry {
  return {
    workId: doc.code,
    entryType: "red-head",
    taskType: "",
    lessonCategory: doc.relatedCategories.join(", "),
    severity: "",
    ministry: doc.issuedBy,
    redHeadRef: doc.code,
    workgroupId: "",
    timeStart: doc.issuedAt,
    timeEnd: doc.issuedAt,
    phase: "",
    fullText: [doc.title, doc.content].join("\n"),
  }
}

// ─── 构建全量索引 ───────────────────────────────────────────────────

/** 从所有归档数据重新构建索引 */
export function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = []
  const workIds = listArchivedWorks()

  for (const workId of workIds) {
    const report = readWorkReport(workId)
    if (report) {
      entries.push(buildEntryFromReport(report))
    }
    const criticism = readSelfCriticism(workId)
    if (criticism) {
      entries.push(buildEntryFromCriticism(criticism))
    }
  }

  return entries
}

/** 保存索引到磁盘 */
export function saveIndex(entries: IndexEntry[]): void {
  ensureDir(INDICES_DIR)
  writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), "utf-8")
}

/** 读取已保存的索引 */
export function loadIndex(): IndexEntry[] {
  if (!existsSync(INDEX_FILE)) return []
  try {
    return JSON.parse(readFileSync(INDEX_FILE, "utf-8")) as IndexEntry[]
  } catch {
    return []
  }
}

/** 重建并保存索引 */
export function rebuildIndex(): IndexEntry[] {
  const entries = buildIndex()
  saveIndex(entries)
  return entries
}

// ─── 查询 ───────────────────────────────────────────────────────────

function matchDimension(entry: IndexEntry, query: IndexQuery): boolean {
  if (query.taskType && !entry.taskType.includes(query.taskType)) return false
  if (query.lessonCategory && !entry.lessonCategory.includes(query.lessonCategory)) return false
  if (query.severity && entry.severity !== query.severity) return false
  if (query.ministry && !entry.ministry.includes(query.ministry)) return false
  if (query.redHeadRef && !entry.redHeadRef.includes(query.redHeadRef)) return false
  if (query.workgroupId && !entry.workgroupId.includes(query.workgroupId)) return false
  if (query.phase && !entry.phase.includes(query.phase)) return false
  // 时间范围：entry 时间区间与查询区间有交集
  if (query.timeStart && entry.timeEnd && entry.timeEnd < query.timeStart) return false
  if (query.timeEnd && entry.timeStart && entry.timeStart > query.timeEnd) return false
  // 全文搜索
  if (query.fullTextSearch) {
    const lower = query.fullTextSearch.toLowerCase()
    if (!entry.fullText.toLowerCase().includes(lower)) return false
  }
  return true
}

/** 按维度查询索引 */
export function queryIndex(query: IndexQuery, entries?: IndexEntry[]): IndexEntry[] {
  const data = entries ?? loadIndex()
  return data.filter(entry => matchDimension(entry, query))
}

// ─── 索引红头文件 ───────────────────────────────────────────────────

/** 将红头文件加入索引（不写入存储层，仅索引入口） */
export function indexRedHeadDocument(doc: RedHeadDocument): IndexEntry {
  const entry = buildEntryFromRedHead(doc)
  const existing = loadIndex()
  // 去重：同 code 替换
  const filtered = existing.filter(e => !(e.entryType === "red-head" && e.workId === doc.code))
  filtered.push(entry)
  saveIndex(filtered)
  return entry
}
