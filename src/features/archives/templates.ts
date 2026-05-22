/**
 * 档案局 — 模板与类型定义
 * 工作报告、自我批评、红头文件、索引条目、消化追踪 等核心数据类型。
 */

// ─── 基础枚举 ───────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low"

export type RootCauseCategory =
  | "设计缺陷"
  | "低级错误"
  | "协作摩擦"
  | "标准歧义"
  | "外部原因"

export type MinistryName = string

export type Phase = string

export type DigestionStatus = "已接收" | "已学习" | "已生成skill" | "已消化"

// ─── 工作报告 ───────────────────────────────────────────────────────

/** 产出清单单项 */
export interface WorkReportOutput {
  filePath: string
  summary: string
}

/** 时间线单项 */
export interface WorkReportTimelineEntry {
  phase: Phase
  startTime: string
  endTime: string | null
  smooth: boolean
  notes?: string
}

/** 协作记录单项 */
export interface WorkReportCollaboration {
  ministry: MinistryName
  interaction: string
  hadWaiting: boolean
}

/** 工作报告 */
export interface WorkReport {
  workId: string
  title: string
  outputs: WorkReportOutput[]
  timeline: WorkReportTimelineEntry[]
  collaborations: WorkReportCollaboration[]
  createdAt: string
}

// ─── 自我批评 ───────────────────────────────────────────────────────

/** 自我批评 */
export interface SelfCriticism {
  workId: string
  problemDescription: string // 具体到文件:行号或 task 编号
  rootCause: RootCauseCategory
  severity: Severity
  improvementSuggestions: string[]
  phase: Phase
  ministry: MinistryName
  createdAt: string
}

// ─── 红头文件 ───────────────────────────────────────────────────────

export interface RedHeadDocument {
  code: string // "国发〔YYYY〕N号"
  title: string
  content: string
  issuedBy: MinistryName
  issuedAt: string
  relatedCategories: string[]
}

// ─── 9 维索引 ───────────────────────────────────────────────────────

/** 索引条目 */
export interface IndexEntry {
  workId: string
  entryType: "work-report" | "self-criticism" | "red-head"
  /** ① 任务类型 */
  taskType: string
  /** ② 教训分类（自我批评时 = rootCause，其他留空） */
  lessonCategory: string
  /** ③ 严重程度 */
  severity: Severity | ""
  /** ④ 涉及部委 */
  ministry: MinistryName
  /** ⑤ 关联红头 */
  redHeadRef: string
  /** ⑥ 工作组 ID */
  workgroupId: string
  /** ⑦ 时间范围 start */
  timeStart: string
  /** ⑦ 时间范围 end */
  timeEnd: string
  /** ⑧ phase 阶段 */
  phase: Phase
  /** ⑨ 全文搜索（拼接的纯文本） */
  fullText: string
}

/** 索引查询条件（全部可选，AND 组合） */
export interface IndexQuery {
  taskType?: string
  lessonCategory?: string
  severity?: Severity
  ministry?: MinistryName
  redHeadRef?: string
  workgroupId?: string
  timeStart?: string
  timeEnd?: string
  phase?: Phase
  fullTextSearch?: string
}

// ─── 消化追踪 ───────────────────────────────────────────────────────

export interface DigestionEntry {
  ministry: MinistryName
  redHeadCode: string
  status: DigestionStatus
  skillName?: string
  digestedAt?: string
}

// ─── 模式分析 ───────────────────────────────────────────────────────

export interface PatternFlag {
  type: "red_head_suggestion" | "staffing_adjustment"
  category?: string
  phase?: string
  count: number
  suggestion: string
}

export interface AnalysisResult {
  patterns: PatternFlag[]
  draftContent?: string
  draftPath?: string
  generatedAt: string
  summary: string
}
