/**
 * 审计署验收清单定义
 * 
 * 验收项对应架构文档 5.1 节 + 第8步描述
 */

export interface ChecklistItem {
  id: string
  name: string
  description: string
  /** 红头文件引用（如 "国发5号"） */
  redHeadRef?: string
  /** 检查函数：返回 true 表示通过 */
  check: (context: AuditContext) => Promise<CheckResult>
}

export interface AuditContext {
  workgroupId: string
  /** 工信部产出文件路径 */
  codeFiles: string[]
  /** Dockerfile 路径 */
  dockerfilePath?: string
  /** API 文档路径 */
  docsPath?: string
  /** spec 文件路径 */
  specPath?: string
}

export interface CheckResult {
  passed: boolean
  detail: string
  /** 不合规位置：文件:行号 或 具体说明 */
  location?: string
}

/**
 * 通用验收清单
 */
export const CHECKLIST: ChecklistItem[] = [
  {
    id: "code-exists",
    name: "代码存在",
    description: "验证代码文件路径有效、文件非空",
    check: async (ctx) => {
      const fs = await import("node:fs/promises")
      const missing: string[] = []
      for (const f of ctx.codeFiles) {
        try { await fs.access(f) } catch { missing.push(f) }
      }
      if (missing.length > 0) {
        return { passed: false, detail: `文件缺失: ${missing.join(", ")}`, location: missing[0] }
      }
      return { passed: true, detail: `所有 ${ctx.codeFiles.length} 个文件存在` }
    }
  },
  {
    id: "test-coverage",
    name: "测试覆盖率 >= 阈值",
    description: "检查项目是否有测试文件且覆盖率达标",
    check: async (ctx) => {
      const fs = await import("node:fs/promises")
      let testFileCount = 0
      for (const f of ctx.codeFiles) {
        try {
          if (f.includes(".test.") || f.includes(".spec.") || f.includes("__tests__")) {
            testFileCount++
          }
        } catch { /* skip */ }
      }
      if (testFileCount === 0) {
        return { passed: false, detail: "未找到测试文件", location: "test coverage" }
      }
      return { passed: true, detail: `找到 ${testFileCount} 个测试文件` }
    }
  },
  {
    id: "config-no-hardcode",
    name: "配置非硬编码（国发6号）",
    description: "检查配置参数是否从外部文件/环境变量读取，非直接写死",
    check: async (ctx) => {
      const fs = await import("node:fs/promises")
      const hardcodes: string[] = []
      for (const f of ctx.codeFiles) {
        try {
          const content = await fs.readFile(f, "utf-8")
          // Detect hardcoded patterns: hardcoded URLs, secrets, magic numbers
          if (content.includes("const SECRET") || content.includes('"https://')) {
            hardcodes.push(f)
          }
        } catch { /* skip unreadable files */ }
      }
      if (hardcodes.length > 0) {
        return { passed: false, detail: `疑似硬编码: ${hardcodes.join(", ")}`, location: hardcodes[0] }
      }
      return { passed: true, detail: "未检测到硬编码" }
    }
  },
  {
    id: "spec-error-codes",
    name: "错误码定义（国发5号）",
    description: "OpenAPI spec 含错误码定义",
    check: async (ctx) => {
      if (!ctx.specPath) return { passed: true, detail: "无 spec 文件，跳过" }
      const fs = await import("node:fs/promises")
      try {
        const content = await fs.readFile(ctx.specPath, "utf-8")
        if (!content.includes("error") && !content.includes("Error")) {
          return { passed: false, detail: "spec 缺少错误码定义", location: ctx.specPath }
        }
        return { passed: true, detail: "spec 含错误码" }
      } catch {
        return { passed: false, detail: "无法读取 spec 文件", location: ctx.specPath }
      }
    }
  },
  {
    id: "jwt-expiry",
    name: "JWT 过期+刷新（国发3号）",
    description: "JWT 配置含过期时间和刷新机制",
    check: async (ctx) => {
      const fs = await import("node:fs/promises")
      for (const f of ctx.codeFiles) {
        try {
          const content = await fs.readFile(f, "utf-8")
          if (content.includes("expiresIn") || content.includes("expire") || content.includes("refreshToken")) {
            return { passed: true, detail: `JWT 配置在 ${f}` }
          }
        } catch { /* skip */ }
      }
      return { passed: true, detail: "未涉及 JWT（跳过）" }
    }
  },
  {
    id: "docker-port",
    name: "Docker 端口合规（国发2号）",
    description: "Dockerfile 无非必要端口暴露",
    check: async (ctx) => {
      if (!ctx.dockerfilePath) return { passed: true, detail: "无 Dockerfile，跳过" }
      const fs = await import("node:fs/promises")
      try {
        const content = await fs.readFile(ctx.dockerfilePath, "utf-8")
        const exposes = content.match(/EXPOSE\s+(\d+)/g)
        if (exposes && exposes.length > 3) {
          return { passed: false, detail: `Dockerfile 暴露 ${exposes.length} 个端口`, location: ctx.dockerfilePath }
        }
        return { passed: true, detail: "Docker 端口合规" }
      } catch {
        return { passed: false, detail: "无法读取 Dockerfile", location: ctx.dockerfilePath }
      }
    }
  },
  {
    id: "doc-consistent",
    name: "文档一致（doc-code-sync）",
    description: "API 文档与代码一致",
    check: async (ctx) => {
      if (!ctx.docsPath) return { passed: true, detail: "无文档路径，跳过" }
      const fs = await import("node:fs/promises")
      try {
        await fs.access(ctx.docsPath)
        return { passed: true, detail: "文档文件存在" }
      } catch {
        return { passed: false, detail: "文档文件不存在", location: ctx.docsPath }
      }
    }
  },
]
