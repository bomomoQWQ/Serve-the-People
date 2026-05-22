/**
 * 档案局 — barrel exports
 * 重导出 archives 功能模块的所有公共 API。
 */

// 模板类型
export type {
  Severity,
  RootCauseCategory,
  MinistryName,
  Phase,
  DigestionStatus,
  WorkReportOutput,
  WorkReportTimelineEntry,
  WorkReportCollaboration,
  WorkReport,
  SelfCriticism,
  RedHeadDocument,
  IndexEntry,
  IndexQuery,
  DigestionEntry,
  PatternFlag,
  AnalysisResult,
} from "./templates"

// 文档模板
export {
  renderWorkReportAndCriticism,
  renderRedHeadDocument,
  renderAuditReport,
  renderLearningReport,
} from "./templates"

// 存储层
export {
  archiveWorkReport,
  readWorkReport,
  archiveSelfCriticism,
  readSelfCriticism,
  readArchive,
  listArchivedWorks,
} from "./storage"

// 9 维索引
export {
  buildIndex,
  saveIndex,
  loadIndex,
  rebuildIndex,
  queryIndex,
  indexRedHeadDocument,
} from "./indices"

// 交叉分析
export {
  analyze,
  listDrafts,
  readDraft,
} from "./analysis"

// 消化追踪
export {
  markDigestion,
  getMinistryDigestion,
  getRedHeadDigestion,
  getAllDigestions,
  isDigested,
  getPendingMinistries,
  markSkillFromRedHead,
} from "./digestion"
