/**
 * Hashline edit — content-hash-anchored file editing.
 *
 * Every Read output line gets tagged with LINE#ID hashes.
 * The edit tool validates the hash before applying changes,
 * preventing edits on stale content (race conditions).
 *
 * Hash algorithm: first 4 chars of SHA-256 of trimmed line content,
 * mapped to a 16-char alphabet (ZPMQVRWSNKTXJBYH).
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const HASH_ALPHABET = "ZPMQVRWSNKTXJBYH"
const HASH_LENGTH = 4

function hashLine(text: string, offset: number): string {
  const input = `${text}|${offset}`
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0
  }
  h = Math.abs(h)
  let result = ""
  for (let i = 0; i < HASH_LENGTH; i++) {
    result += HASH_ALPHABET[h % 16]
    h = Math.floor(h / 16)
  }
  return result
}

function hashContent(lines: string[]): Map<number, string> {
  const map = new Map<number, string>()
  for (let i = 0; i < lines.length; i++) {
    map.set(i + 1, hashLine(lines[i].trimEnd(), i))
  }
  return map
}

/**
 * Tag read output lines with LINE#ID hashes.
 * Inserted as a prefix to each line: "LINE#ABCD: original content"
 */
export function tagReadOutput(content: string, filePath: string): string {
  const lines = content.split("\n")
  const hashes = hashContent(lines)
  return lines.map((line, i) => {
    const lineNum = i + 1
    const hash = hashes.get(lineNum) ?? "0000"
    return `${lineNum}: LINE#${hash} ${line}`
  }).join("\n")
}

export function createHashlineEditTool(): ToolDefinition {
  return tool({
    description:
      "精确文件编辑。old_string 必须包含 LINE#ID 前缀以确保编辑的是当前版本。\n" +
      "用法: 先用 Read 读取文件（自动附加 LINE#ID），复制目标行（含 LINE#ID 前缀），再调用此工具。",
    args: {
      file_path: tool.schema.string()
        .describe("要编辑的文件的绝对路径"),
      old_string: tool.schema.string()
        .describe("要替换的原文（必须包含 LINE#ID 前缀，从 Read 输出中复制）"),
      new_string: tool.schema.string()
        .describe("替换后的文本（不需要 LINE#ID 前缀）"),
      replace_all: tool.schema.boolean().optional()
        .describe("替换所有匹配（默认 false）"),
    },
    execute: async (args, context) => {
      const filePath = args.file_path as string
      const oldString = args.old_string as string
      const newString = args.new_string as string
      const replaceAll = (args.replace_all as boolean) ?? false
      const cwd = (context as { cwd?: string } | undefined)?.cwd ?? process.cwd()

      const absPath = resolve(cwd, filePath)
      if (!existsSync(absPath)) return `错误：文件不存在: ${absPath}`

      const content = readFileSync(absPath, "utf-8")
      const lines = content.split("\n")

      // Strip LINE#ID prefixes from old_string to get actual text to match
      const oldWithoutHash = stripHashPrefixes(oldString)

      // Find the match in the file (exact text match after stripping LINE#IDs)
      if (content.includes(oldWithoutHash)) {
        const count = content.split(oldWithoutHash).length - 1
        if (count > 1 && !replaceAll) {
          return `错误：找到 ${count} 处匹配，请提供更多上下文或设置 replace_all=true。\n匹配位置：\n` +
            lines
              .map((l, i) => l.includes(oldWithoutHash.split("\n")[0]) ? `${i + 1}: ${l.slice(0, 80)}` : null)
              .filter(Boolean)
              .join("\n")
        }

        // Validate LINE#ID hashes if present
        if (oldString.includes("LINE#")) {
          const hashValidation = validateHashlines(oldString, lines)
          if (hashValidation !== true) {
            return `LINE#ID 验证失败：文件内容已变更。\n${hashValidation}\n请重新 Read 文件获取最新 LINE#ID。`
          }
        }

        const newContent = replaceAll
          ? content.split(oldWithoutHash).join(newString)
          : content.replace(oldWithoutHash, newString)

        writeFileSync(absPath, newContent, "utf-8")
        return `✅ 已编辑 ${absPath}`
      }

      return `错误：未找到匹配文本。请确认 old_string 是从 Read 输出中复制的（含 LINE#ID 前缀），或去掉 LINE#ID 前缀后重试。`
    },
  })
}

function stripHashPrefixes(text: string): string {
  return text
    .split("\n")
    .map(line => {
      // Remove LINE#ID prefix: "LINE#ABCD " or "42: LINE#ABCD "
      const match = line.match(/^(?:\d+:\s*)?LINE#[A-Z]{4}\s+/)
      return match ? line.slice(match[0].length) : line
    })
    .join("\n")
}

function validateHashlines(oldString: string, fileLines: string[]): true | string {
  const oldLines = oldString.split("\n")
  const currentHashes = hashContent(fileLines)
  const mismatches: string[] = []

  for (const line of oldLines) {
    const match = line.match(/^(?:(\d+):\s*)?LINE#([A-Z]{4})\s+/)
    if (!match) continue

    const lineNum = match[1] ? parseInt(match[1]) : undefined
    const expectedHash = match[2]

    if (lineNum !== undefined) {
      const actualHash = currentHashes.get(lineNum)
      if (actualHash && actualHash !== expectedHash) {
        mismatches.push(`  Line ${lineNum}: expected LINE#${expectedHash}, actual LINE#${actualHash}`)
      }
    }
  }

  return mismatches.length === 0 ? true : mismatches.join("\n")
}
