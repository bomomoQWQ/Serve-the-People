/**
 * LSP diagnostics tool — runs project typecheck and parses output.
 *
 * This is a lightweight replacement for the full LSP MCP server.
 * It runs `bun run typecheck` or `tsc --noEmit` and parses error output.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { execSync } from "node:child_process"

interface Diagnostic {
  file: string
  line: number
  column: number
  severity: "error" | "warning"
  message: string
  code: string
}

function parseTscOutput(output: string, cwd: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const lines = output.split(/\r?\n/)
  for (const line of lines) {
    // tsc format: file.ts(line,col): error TS####: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/)
    if (match) {
      diagnostics.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        severity: match[4] as "error" | "warning",
        code: match[5],
        message: match[6],
      })
    }
  }
  return diagnostics
}

export function createLspDiagnosticsTool(): ToolDefinition {
  return tool({
    description:
      "运行项目类型检查（tsc --noEmit 或 bun run typecheck），返回诊断错误/警告列表。用于代码提交前验证。",
    args: {
      file_path: tool.schema.string().optional()
        .describe("仅检查指定文件（可选，不传则全项目检查）"),
      severity: tool.schema.string().optional()
        .describe("过滤: error, warning, all（默认 all）"),
    },
    execute: async (args, context) => {
      const filePath = args.file_path as string | undefined
      const severity = (args.severity as string) ?? "all"
      // context may not have cwd, default to process.cwd()
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      try {
        const cmd = filePath
          ? `npx tsc --noEmit --pretty false 2>&1 | Select-String "${filePath.replace(/\\/g, "\\\\")}"`
          : process.platform === "win32"
            ? "npx tsc --noEmit --pretty false 2>&1"
            : "npx tsc --noEmit --pretty false 2>&1"

        const output = execSync(cmd, {
          cwd,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
          timeout: 120000,
          env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
        })

        if (!output.trim()) return "✅ 类型检查通过，无错误。"
        const all = parseTscOutput(output, cwd)
        const filtered = severity === "all"
          ? all
          : all.filter(d => d.severity === severity)

        if (filtered.length === 0) return "✅ 类型检查通过，无匹配诊断。"
        return filtered.map(d =>
          `${d.severity === "error" ? "❌" : "⚠️"} ${d.file}:${d.line}:${d.column} — ${d.code}: ${d.message}`
        ).join("\n")
      } catch (e) {
        // tsc exits non-zero on errors, output is in stderr
        const err = e as { stdout?: string; stderr?: string; message?: string }
        const output = err.stdout || err.stderr || err.message || ""
        if (!output.trim() && !filePath) return "✅ 类型检查通过，无错误。"

        const all = parseTscOutput(output, cwd)
        const filtered = severity === "all"
          ? all
          : all.filter(d => d.severity === severity)

        if (filtered.length === 0) {
          return output.trim()
            ? `类型检查发现非标准格式问题:\n${output.slice(0, 2000)}`
            : "✅ 类型检查通过。"
        }

        return [
          `发现 ${filtered.length} 个问题：`,
          ...filtered.map(d =>
            `${d.severity === "error" ? "❌" : "⚠️"} ${d.file}:${d.line}:${d.column} — ${d.code}: ${d.message}`
          ),
        ].join("\n")
      }
    },
  })
}
