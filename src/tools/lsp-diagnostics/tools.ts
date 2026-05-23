/**
 * LSP diagnostics tool — runs project typecheck and parses output.
 *
 * Uses Bun.spawn for async, non-blocking execution.
 * Cross-platform: no PowerShell/Select-String dependency.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

interface Diagnostic {
  file: string
  line: number
  column: number
  severity: "error" | "warning"
  message: string
  code: string
}

function parseTscOutput(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+):\s*(.+)$/)
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

async function runTypecheck(cwd: string): Promise<{ output: string; exitCode: number }> {
  const proc = Bun.spawn(["npx", "tsc", "--noEmit", "--pretty", "false"], {
    cwd,
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited

  return { output: stdout + stderr, exitCode }
}

export function createLspDiagnosticsTool(): ToolDefinition {
  return tool({
    description:
      "运行项目类型检查（tsc --noEmit），返回诊断错误/警告列表。代码提交前验证。",
    args: {
      file_path: tool.schema.string().optional()
        .describe("仅过滤指定文件的诊断（可选，不传则全部）"),
      severity: tool.schema.string().optional()
        .describe("过滤: error, warning, all（默认 all）"),
    },
    execute: async (args, context) => {
      const filePath = args.file_path as string | undefined
      const severity = (args.severity as string) ?? "all"
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      try {
        const { output, exitCode } = await runTypecheck(cwd)
        if (!output.trim() && exitCode === 0) return "✅ 类型检查通过，无错误。"

        const all = parseTscOutput(output)
        let filtered = severity === "all" ? all : all.filter(d => d.severity === severity)

        if (filePath) {
          filtered = filtered.filter(d => d.file.includes(filePath))
        }

        if (filtered.length === 0) {
          return exitCode === 0
            ? "✅ 类型检查通过，无匹配诊断。"
            : `类型检查发现 ${all.length} 个问题（全部文件），当前过滤无匹配：\n` +
              all.slice(0, 3).map(d => `${d.file}:${d.line} — ${d.message}`).join("\n")
        }

        return [
          `发现 ${filtered.length} 个问题：`,
          ...filtered.map(d =>
            `${d.severity === "error" ? "❌" : "⚠️"} ${d.file}:${d.line}:${d.column} — ${d.code}: ${d.message}`
          ),
        ].join("\n")
      } catch (e) {
        return `类型检查失败: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
