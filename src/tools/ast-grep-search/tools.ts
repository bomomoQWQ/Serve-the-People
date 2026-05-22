/**
 * AST-grep search tool — AST-aware code pattern search.
 *
 * Uses @ast-grep/cli (sg) to search code with AST patterns.
 * Falls back to grep if sg is not available.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { execSync } from "node:child_process"

const SUPPORTED_LANGUAGES = [
  "typescript", "tsx", "javascript", "python", "rust", "go",
  "java", "c", "cpp", "csharp", "bash", "css", "html", "json",
  "yaml", "kotlin", "swift", "ruby", "lua", "scala", "nix",
  "elixir", "haskell", "php", "solidity",
] as const

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
      context: tool.schema.number().optional()
        .describe("显示上下文行数（默认 2）"),
    },
    execute: async (args, context) => {
      const pattern = args.pattern as string
      const lang = args.lang as string | undefined
      const paths = (args.paths as string[]) ?? ["."]
      const ctxLines = (args.context as number) ?? 2
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      if (!lang || !SUPPORTED_LANGUAGES.includes(lang as typeof SUPPORTED_LANGUAGES[number])) {
        return `错误：不支持的语言 "${lang}"。支持: ${SUPPORTED_LANGUAGES.join(", ")}`
      }

      try {
        const pathArgs = paths.map(p => `"${p}"`).join(" ")
        const cmd = `npx sg scan --pattern "${pattern.replace(/"/g, '\\"')}" --lang ${lang} ${pathArgs} --json`

        const output = execSync(cmd, {
          cwd,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
          timeout: 60000,
          env: { ...process.env, NO_COLOR: "1" },
        })

        if (!output.trim()) return "未找到匹配。"
        const results = JSON.parse(output) as Array<{
          file: string
          lines: string
          range: { start: { line: number; column: number }; end: { line: number; column: number } }
        }>

        if (results.length === 0) return "未找到匹配。"
        return results.slice(0, 50).map(r =>
          `### ${r.file}:${r.range.start.line}\n\`\`\`${lang}\n${r.lines}\n\`\`\``
        ).join("\n\n")
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message?: string }
        const errorMsg = err.stderr || err.message || ""
        if (errorMsg.includes("not found") || errorMsg.includes("ENOENT")) {
          return "AST-grep (sg) 未安装。请运行 `bun add @ast-grep/cli` 或使用 grep 替代。"
        }
        if (errorMsg.includes("Cannot parse")) {
          return `AST 模式解析失败: ${errorMsg.slice(0, 500)}\n请检查 pattern 语法。`
        }
        return `AST-grep 搜索失败: ${errorMsg.slice(0, 1000)}`
      }
    },
  })
}
