/**
 * LSP Symbols tool — extract document symbols from TypeScript/JavaScript.
 *
 * Uses tsc's declaration output or regex for practical symbol extraction.
 * This is a lightweight replacement for the full LSP documentSymbols request.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

interface SymbolInfo {
  name: string
  kind: "function" | "class" | "interface" | "type" | "variable" | "export"
  file: string
  line: number
  container?: string
}

function parseSymbols(content: string, file: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = []
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // export const/let/var/function/class/interface/type/enum
    const exportMatch = line.match(
      /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/
    )
    if (exportMatch) {
      symbols.push({ name: exportMatch[1], kind: "export", file, line: lineNum })
      continue
    }

    // async function / function
    const funcMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
    if (funcMatch) {
      symbols.push({ name: funcMatch[1], kind: "function", file, line: lineNum })
      continue
    }

    // class
    const classMatch = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/)
    if (classMatch) {
      symbols.push({ name: classMatch[1], kind: "class", file, line: lineNum })
      continue
    }

    // interface
    const ifaceMatch = line.match(/^\s*(?:export\s+)?interface\s+(\w+)/)
    if (ifaceMatch) {
      symbols.push({ name: ifaceMatch[1], kind: "interface", file, line: lineNum })
      continue
    }

    // type alias
    const typeMatch = line.match(/^\s*(?:export\s+)?type\s+(\w+)\s*=/)
    if (typeMatch) {
      symbols.push({ name: typeMatch[1], kind: "type", file, line: lineNum })
      continue
    }
  }
  return symbols
}

export function createLspSymbolsTool(): ToolDefinition {
  return tool({
    description:
      "提取文档/项目符号（函数、类、接口、类型、导出）。用于代码导航和结构理解。",
    args: {
      file_path: tool.schema.string().optional()
        .describe("文件路径（不传则搜当前目录所有 .ts 文件）"),
      scope: tool.schema.string().optional()
        .describe("document（单文件）或 workspace（项目级，默认）"),
      query: tool.schema.string().optional()
        .describe("符号名过滤（可选，支持部分匹配）"),
    },
    execute: async (args, context) => {
      const filePath = args.file_path as string | undefined
      const scope = (args.scope as string) ?? "workspace"
      const query = (args.query as string) ?? ""
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      const { readFileSync, readdirSync, existsSync, statSync } = await import("node:fs")
      const { join, extname, relative } = await import("node:path")

      const filesToScan: string[] = []
      if (filePath) {
        const abs = join(cwd, filePath)
        if (existsSync(abs)) filesToScan.push(abs)
      } else if (scope === "document") {
        return "错误：document 范围需要 file_path 参数。"
      } else {
        // workspace — scan src/ for .ts files
        const scanDir = (dir: string) => {
          if (!existsSync(dir)) return
          const entries = readdirSync(dir)
          for (const e of entries) {
            if (e.startsWith(".") || e === "node_modules" || e === "dist") continue
            const full = join(dir, e)
            try {
              const st = statSync(full)
              if (st.isDirectory()) scanDir(full)
              else if (st.isFile() && [".ts", ".tsx"].includes(extname(full))) {
                filesToScan.push(full)
              }
            } catch { /* skip */ }
          }
        }
        scanDir(join(cwd, "src"))
        if (filesToScan.length === 0) scanDir(cwd)
      }

      if (filesToScan.length === 0) return "未找到 TypeScript 文件。"

      const allSymbols: SymbolInfo[] = []
      for (const f of filesToScan.slice(0, 200)) {
        try {
          const content = readFileSync(f, "utf-8")
          const syms = parseSymbols(content, relative(cwd, f))
          if (query) allSymbols.push(...syms.filter(s => s.name.toLowerCase().includes(query.toLowerCase())))
          else allSymbols.push(...syms)
        } catch { /* skip unreadable */ }
      }

      if (allSymbols.length === 0) return query ? `未找到匹配 "${query}" 的符号。` : "未找到符号。"

      const byKind = new Map<string, SymbolInfo[]>()
      for (const s of allSymbols) {
        const list = byKind.get(s.kind) ?? []
        list.push(s)
        byKind.set(s.kind, list)
      }

      const lines: string[] = [`找到 ${allSymbols.length} 个符号（${filesToScan.length} 个文件）：`]
      for (const [kind, syms] of byKind) {
        lines.push(`\n### ${kind} (${syms.length})`)
        for (const s of syms.slice(0, 30)) {
          lines.push(`  ${s.name} — ${s.file}:${s.line}`)
        }
        if (syms.length > 30) lines.push(`  ...及其他 ${syms.length - 30} 项`)
      }
      return lines.join("\n")
    },
  })
}
