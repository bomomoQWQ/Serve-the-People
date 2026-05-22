/**
 * AST-grep search tool — AST-aware code pattern search.
 *
 * Uses @ast-grep/cli (sg) via Bun.spawn for async, non-blocking execution.
 * Cross-platform argument passing (no shell string interpolation).
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

const SUPPORTED_LANGUAGES = [
  "typescript", "tsx", "javascript", "python", "rust", "go",
  "java", "c", "cpp", "csharp", "bash", "css", "html", "json",
  "yaml", "kotlin", "swift", "ruby", "lua", "scala", "nix",
  "elixir", "haskell", "php", "solidity",
] as const

async function runSgScan(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["npx", "sg", ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

export function createAstGrepSearchTool(): ToolDefinition {
  return tool({
    description:
      "AST 感知的代码模式搜索。使用 sg scan 匹配代码结构而不仅仅是文本。支持 25 种语言。",
    args: {
      pattern: tool.schema.string()
        .describe("AST 模式。元变量: $VAR（单节点），$$$VAR（多节点）。\n" +
          "例: 'console.log($MSG)', 'async function $NAME($$$) { $$$ }'"),
      lang: tool.schema.string()
        .describe(`目标语言: ${SUPPORTED_LANGUAGES.join(", ")}`),
      paths: tool.schema.array(tool.schema.string()).optional()
        .describe("搜索路径（默认当前目录）"),
    },
    execute: async (args, context) => {
      const pattern = args.pattern as string
      const lang = args.lang as string | undefined
      const paths = (args.paths as string[]) ?? ["."]
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      if (!lang || !SUPPORTED_LANGUAGES.includes(lang as typeof SUPPORTED_LANGUAGES[number])) {
        return `错误：不支持的语言 "${lang}"。支持: ${SUPPORTED_LANGUAGES.join(", ")}`
      }

      const sgArgs = ["scan", "--pattern", pattern, "--lang", lang, "--json", ...paths]

      try {
        const { stdout, stderr, exitCode } = await runSgScan(sgArgs, cwd)

        if (stderr && !stdout) {
          if (stderr.includes("not found") || stderr.includes("ENOENT")) {
            return "AST-grep (sg) 未安装。请运行 `bun add @ast-grep/cli`。"
          }
          if (stderr.includes("Cannot parse")) {
            return `AST 模式解析失败: ${stderr.slice(0, 500)}`
          }
          return `AST-grep 错误: ${stderr.slice(0, 500)}`
        }

        if (!stdout.trim()) return "未找到匹配。"

        const results = JSON.parse(stdout) as Array<{
          file: string
          lines: string
          range: { start: { line: number; column: number }; end: { line: number; column: number } }
        }>

        if (results.length === 0) return "未找到匹配。"
        return results.slice(0, 50).map(r =>
          `### ${r.file}:${r.range.start.line}\n\`\`\`${lang}\n${r.lines}\n\`\`\``
        ).join("\n\n")
      } catch (e) {
        return `AST-grep 搜索失败: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
