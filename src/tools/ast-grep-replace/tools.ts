/**
 * AST-grep replace tool — AST-aware code pattern replacement.
 *
 * Uses @ast-grep/cli (sg scan --rewrite) via Bun.spawn.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

const SUPPORTED_LANGUAGES = [
  "typescript", "tsx", "javascript", "python", "rust", "go",
  "java", "c", "cpp", "csharp", "bash", "css", "html", "json",
  "yaml", "kotlin", "swift", "ruby", "lua", "scala", "nix",
  "elixir", "haskell", "php", "solidity",
] as const

async function runSg(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
  return { stdout, stderr, exitCode: await proc.exited }
}

export function createAstGrepReplaceTool(): ToolDefinition {
  return tool({
    description:
      "AST 感知的代码模式替换。使用 sg scan --rewrite 进行结构化的代码修改。元变量 $VAR 保留匹配内容。",
    args: {
      pattern: tool.schema.string()
        .describe("AST 匹配模式。例: 'console.log($MSG)'"),
      rewrite: tool.schema.string()
        .describe("替换模式。例: 'logger.info($MSG)'"),
      lang: tool.schema.string()
        .describe(`目标语言: ${SUPPORTED_LANGUAGES.join(", ")}`),
      paths: tool.schema.array(tool.schema.string()).optional()
        .describe("搜索替换路径（默认当前目录）"),
      dry_run: tool.schema.boolean().optional()
        .describe("仅预览不写盘（默认 true）"),
    },
    execute: async (args, context) => {
      const pattern = args.pattern as string
      const rewrite = args.rewrite as string
      const lang = args.lang as string | undefined
      const paths = (args.paths as string[]) ?? ["."]
      const dryRun = args.dry_run !== false
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      if (!lang || !SUPPORTED_LANGUAGES.includes(lang as typeof SUPPORTED_LANGUAGES[number])) {
        return `错误：不支持的语言 "${lang}"。支持: ${SUPPORTED_LANGUAGES.join(", ")}`
      }

      const sgArgs = [
        "scan",
        "--pattern", pattern,
        "--rewrite", rewrite,
        "--lang", lang,
        ...(dryRun ? [] : ["--update-all"]),
        "--json",
        ...paths,
      ]

      try {
        const { stdout, stderr } = await runSg(sgArgs, cwd)

        if (stderr && !stdout) {
          if (stderr.includes("Cannot parse")) return `AST 模式解析失败: ${stderr.slice(0, 300)}`
          return `错误: ${stderr.slice(0, 300)}`
        }

        const results = JSON.parse(stdout) as Array<{
          file: string
          range: { start: { line: number } }
          replacement?: string
        }>

        if (results.length === 0) return "未找到匹配。"

        const mode = dryRun ? "预览（dry-run）" : "已应用"
        return [
          `${mode}: ${results.length} 处替换`,
          ...results.map(r => {
            const loc = `${r.file}:${r.range.start.line}`
            if (r.replacement) return `${loc}\n\`\`\`\n${r.replacement}\n\`\`\``
            return loc
          }),
        ].join("\n\n")
      } catch (e) {
        return `替换失败: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
