/**
 * 审计署 与 应急管理部 验收清单定义
 *
 * 分工：
 *   审计署 — 黑盒功能验收（cos 普通用户，按 README 走流程，不碰代码）
 *   应急管理部 — 代码级验证（端口暴露、配置硬编码、JWT、测试覆盖、安全扫描）
 */

export interface ChecklistItem {
  id: string
  name: string
  description: string
  /** 红头文件引用 */
  redHeadRef?: string
}

/** ─── 审计署：黑盒功能验收 ─── */
export const AUDIT_CHECKLIST: ChecklistItem[] = [
  {
    id: "readme-install",
    name: "README 安装流程能跑通",
    description:
      "按 README 的安装步骤（clone→install→build→run）逐条执行，记录每一步是否成功、是否有遗漏或错误。安装失败 = 不通过。",
  },
  {
    id: "core-feature-runs",
    name: "核心功能正常运行",
    description:
      "按需求方案中列出的核心功能列表，逐项执行验证。功能不可用、输出明显错误、无响应超过 30 秒 = 不通过。",
  },
  {
    id: "error-handling-graceful",
    name: "异常输入不崩溃",
    description:
      "对每个核心入口传入无效/越界/空参数，验证是否返回可理解的错误信息（不含堆栈 trace），服务是否继续运行。崩溃或无响应 = 不通过。",
  },
  {
    id: "output-matches-docs",
    name: "输出与文档一致",
    description:
      "执行文档中列出的示例命令/请求，对比实际输出与文档描述。输出格式、字段名、状态码与文档不一致 = 不通过。",
  },
  {
    id: "api-endpoints-work",
    name: "API 端点文档一致性",
    description:
      "按 API 文档列出的所有端点逐个请求，验证返回状态码、响应体结构是否与文档一致。404、500、字段缺失、格式不符 = 不通过。",
  },
  {
    id: "feature-completeness",
    name: "功能完整性",
    description:
      "对照发改委的方案中列出的交付物清单，逐项检查是否均已实现。缺项 = 不通过",
  },
]

/** ─── 应急管理部：代码级验证 ─── */
export const TECH_CHECKLIST: ChecklistItem[] = [
  {
    id: "config-no-hardcode",
    name: "配置非硬编码（国发6号）",
    description:
      "检查配置参数是否从外部文件/环境变量读取，是否存在直接写死的 URL/密钥/魔术数字。",
    redHeadRef: "国发6号",
  },
  {
    id: "jwt-expiry",
    name: "JWT 含过期+刷新（国发3号）",
    description:
      "检查 JWT 配置是否设置过期时间、是否提供刷新机制。",
    redHeadRef: "国发3号",
  },
  {
    id: "spec-error-codes",
    name: "OpenAPI spec 含错误码定义（国发5号）",
    description:
      "检查 OpenAPI spec 是否包含各端点的错误响应定义和错误码说明。",
    redHeadRef: "国发5号",
  },
  {
    id: "docker-port",
    name: "Dockerfile 无非必要端口暴露（国发2号）",
    description:
      "检查 Dockerfile EXPOSE 指令是否只暴露必要端口，是否存在多余端口。",
    redHeadRef: "国发2号",
  },
  {
    id: "test-coverage",
    name: "测试覆盖率达标",
    description:
      "检查项目是否有测试文件，测试覆盖是否覆盖核心路径（happy path + 边界条件）。",
  },
  {
    id: "cve-scan",
    name: "安全扫描无高危漏洞",
    description:
      "检查依赖是否有已知 CVE 高危漏洞。高危未报告 = 不通过。",
  },
]

/** 通用清单（按需使用） */
export const ALL_CHECKLISTS = [...AUDIT_CHECKLIST, ...TECH_CHECKLIST]
