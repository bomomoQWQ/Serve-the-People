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

// ─── 文档模板 ─────────────────────────────────────────────────────────

/** 渲染《(部委)对(TASK-ID)的工作报告与自我批评》*/
export function renderWorkReportAndCriticism(
  ministry: string,
  taskId: string,
  report: Omit<WorkReport, "workId" | "createdAt"> & { createdAt?: string },
  criticisms: Omit<SelfCriticism, "workId" | "ministry" | "createdAt">[],
): string {
  const lines: string[] = [
    `# ${ministry}对 ${taskId} 的工作报告与自我批评`,
    "",
    `日期：${report.createdAt ?? new Date().toISOString().slice(0, 10)}`,
    "",
    "---",
    "",
    "## 一、工作报告",
    "",
    ...renderOutputs(report.outputs),
    ...renderTimeline(report.timeline),
    ...renderCollaborations(report.collaborations),
    "",
    "---",
    "",
    "## 二、自我批评",
    "",
    ...(criticisms.length === 0 ? ["本月无自我批评事项。"] : criticisms.flatMap(renderCriticism)),
  ]
  return lines.join("\n")
}

function renderOutputs(outputs: WorkReportOutput[]): string[] {
  if (outputs.length === 0) return ["（无产出记录）"]
  return ["### 1.1 产出清单", "", ...outputs.map(o => `- **${o.filePath}**：${o.summary}`)]
}

function renderTimeline(timeline: WorkReportTimelineEntry[]): string[] {
  if (timeline.length === 0) return []
  return [
    "### 1.2 时间线",
    "",
    ...timeline.map(t =>
      `- [${t.startTime} → ${t.endTime ?? "至今"}] **${t.phase}** ${t.smooth ? "✅ 顺利" : "⚠️ 卡顿"}${t.notes ? ` — ${t.notes}` : ""}`
    ),
  ]
}

function renderCollaborations(collabs: WorkReportCollaboration[]): string[] {
  if (collabs.length === 0) return []
  return [
    "### 1.3 协作记录",
    "",
    ...collabs.map(c =>
      `- **${c.ministry}**：${c.interaction}${c.hadWaiting ? " （有等待）" : ""}`
    ),
  ]
}

function renderCriticism(c: Omit<SelfCriticism, "workId" | "ministry" | "createdAt">, index: number): string[] {
  return [
    `### 2.${index + 1} ${c.problemDescription.slice(0, 60)}`,
    "",
    `- **问题描述**：${c.problemDescription}`,
    `- **根因分类**：${c.rootCause}`,
    `- **严重程度**：${c.severity}`,
    `- **发生阶段**：${c.phase}`,
    `- **改进建议**：`,
    ...(c.improvementSuggestions.map(s => `  - ${s}`)),
  ]
}

/** 渲染《国务院 (YYYY) NN号文件 关于(TASK-ID)项目中的若干问题的意见》*/
export function renderRedHeadDocument(
  year: number,
  number: number,
  taskId: string,
  category: string,
  lessons: string[],
): string {
  const code = `国发〔${year}〕${number}号`
  const lines = [
    `# ${code}`,
    `# 关于 ${taskId} 项目中${category}问题的若干意见`,
    "",
    `国务院 ${year}年${String(new Date().getMonth() + 1).padStart(2, "0")}月${String(new Date().getDate()).padStart(2, "0")}日`,
    "",
    "---",
    "",
    "## 背景",
    "",
    `工作组 ${taskId} 在执行过程中暴露出以下${category}相关问题：`,
    "",
    ...lessons.map((l, i) => `${i + 1}. ${l}`),
    "",
    "## 意见",
    "",
    "（由国务院根据档案局《若干问题》草案和用户讨论后填写）",
    "",
    "## 要求",
    "",
    "1. 有关部门应在收到本文件后及时组织学习，将意见转化为 skill。",
    "2. 下一次工作中自动加载相应 skill，防止同类问题再次发生。",
    "3. 档案局负责追踪各部委对意见的消化情况。",
    "",
    "---",
    "",
    "签发：国务院",
  ]
  return lines.join("\n")
}

/** 渲染《对(TASK-ID)项目的审计报告》*/
export function renderAuditReport(
  taskId: string,
  round: number,
  passed: boolean,
  failures: string[],
): string {
  const lines = [
    `# 对 ${taskId} 项目的审计报告`,
    "",
    `验收轮次：第 ${round}/3 轮`,
    `时间：${new Date().toISOString()}`,
    "",
    "---",
    "",
    `## 验收结果：${passed ? "✅ 通过" : "❌ 不合格"}`,
    "",
  ]

  if (passed) {
    lines.push(
      "经逐项验收，功能完整性、文档一致性、用户路径均通过检查。",
      "",
      "验收清单：",
      "- [x] README 安装流程能跑通",
      "- [x] 核心功能正常运行",
      "- [x] 异常输入不崩溃",
      "- [x] 输出与文档一致",
      "- [x] API 端点文档一致性",
      "- [x] 功能完整性",
    )
  } else if (round >= 3) {
    lines.push(
      `以下 ${failures.length} 项经 ${round} 轮仍不合格，标记已知缺陷放行：`,
      "",
      ...failures.map((f, i) => `${i + 1}. ${f}`),
    )
  } else {
    lines.push(
      `以下 ${failures.length} 项不合格，退回整改后重新验收：`,
      "",
      ...failures.map((f, i) => `${i + 1}. ${f}`),
    )
  }

  lines.push(
    "",
    "---",
    "",
    "审计署",
    new Date().toISOString().slice(0, 10),
  )
  return lines.join("\n")
}
