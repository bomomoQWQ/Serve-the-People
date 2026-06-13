/**
 * 档案局 — 技能消化追踪
 * 追踪各部委对红头文件的学习消化状态。
 * Layout: ~/.servethepeople/archives/digestion.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { ARCHIVE_ROOT_GLOBAL } from "../../shared/paths"
import type { DigestionEntry, DigestionStatus, MinistryName } from "./templates"

const DIGESTION_FILE = join(ARCHIVE_ROOT_GLOBAL, "digestion.json")

const DigestionEntrySchema = z.object({
  ministry: z.string(),
  redHeadCode: z.string(),
  status: z.enum(["已接收", "已学习", "已生成skill", "已消化"]),
  skillName: z.string().optional(),
  digestedAt: z.string().optional(),
})

function readDigestionFile(): DigestionEntry[] {
  if (!existsSync(DIGESTION_FILE)) return []
  try {
    const raw = JSON.parse(readFileSync(DIGESTION_FILE, "utf-8"))
    return z.array(DigestionEntrySchema).parse(raw) as DigestionEntry[]
  } catch {
    return []
  }
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

function writeDigestionFile(entries: DigestionEntry[]): void {
  ensureDir(ARCHIVE_ROOT_GLOBAL)
  writeFileSync(DIGESTION_FILE, JSON.stringify(entries, null, 2), "utf-8")
}

// ─── CRUD ───────────────────────────────────────────────────────────

/** 记录某部委对某红头文件的消化状态 */
export function markDigestion(
  ministry: MinistryName,
  redHeadCode: string,
  status: DigestionStatus,
  skillName?: string,
): DigestionEntry {
  const entries = readDigestionFile()

  // 删除旧记录（同 ministry + redHeadCode 去重）
  const filtered = entries.filter(
    e => !(e.ministry === ministry && e.redHeadCode === redHeadCode),
  )

  const entry: DigestionEntry = {
    ministry,
    redHeadCode,
    status,
    skillName,
    digestedAt: status === "已消化" ? new Date().toISOString() : undefined,
  }
  filtered.push(entry)

  writeDigestionFile(filtered)
  return entry
}

/** 查询某部委对所有红头文件的消化状态 */
export function getMinistryDigestion(ministry: MinistryName): DigestionEntry[] {
  return readDigestionFile()
    .filter(e => e.ministry === ministry)
    .sort((a, b) => (a.redHeadCode).localeCompare(b.redHeadCode))
}

/** 查询某红头文件被各部委消化的状态 */
export function getRedHeadDigestion(redHeadCode: string): DigestionEntry[] {
  return readDigestionFile()
    .filter(e => e.redHeadCode === redHeadCode)
    .sort((a, b) => a.ministry.localeCompare(b.ministry))
}

/** 获取所有消化记录 */
export function getAllDigestions(): DigestionEntry[] {
  return readDigestionFile()
}

/** 检查某部委是否已消化某红头文件 */
export function isDigested(ministry: MinistryName, redHeadCode: string): boolean {
  return readDigestionFile().some(
    e => e.ministry === ministry && e.redHeadCode === redHeadCode && e.status === "已消化",
  )
}

/** 获取尚未完全消化的部委列表（针对某红头文件） */
export function getPendingMinistries(redHeadCode: string): MinistryName[] {
  return readDigestionFile()
    .filter(e => e.redHeadCode === redHeadCode && e.status !== "已消化")
    .map(e => e.ministry)
}

/** 将一部委的 skill 标记为源自某红头文件的消化产物 */
export function markSkillFromRedHead(
  ministry: MinistryName,
  redHeadCode: string,
  skillName: string,
): DigestionEntry {
  return markDigestion(ministry, redHeadCode, "已生成skill", skillName)
}
