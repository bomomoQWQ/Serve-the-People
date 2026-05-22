import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { runRg } from "../../shared/ripgrep-cli"

export function createGrepTools(): Record<string, ToolDefinition> {
  const grep: ToolDefinition = tool({
    description:
      "Fast content search tool with safety limits (60s timeout, 256KB output). " +
      "Searches file contents using regular expressions. " +
      "Supports full regex syntax. " +
      "Filter files by pattern with the include parameter. " +
      'Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts per file.',
    args: {
      pattern: tool.schema.string().describe("The regex pattern to search for in file contents"),
      include: tool.schema.string().optional().describe('File pattern to include (e.g. "*.js", "*.{ts,tsx}")'),
      path: tool.schema.string().optional().describe("The directory to search in. Defaults to the current working directory."),
      output_mode: tool.schema.enum(["content", "files_with_matches", "count"]).optional()
        .describe('Output mode: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts per file.'),
      head_limit: tool.schema.number().optional().describe("Limit output to first N entries. 0 or omitted means no limit."),
    },
    execute: async (args, context) => {
      try {
        const cwd = (context as Record<string, unknown>).directory as string | undefined
        const searchPath = args.path ?? "."
        const outputMode = args.output_mode ?? "files_with_matches"
        const headLimit = args.head_limit ?? 0

        const rgArgs: string[] = ["--no-heading", "--color", "never", "--line-number"]

        if (args.include) {
          rgArgs.push("--glob", args.include)
        }

        if (outputMode === "files_with_matches") {
          rgArgs.push("-l")
        } else if (outputMode === "count") {
          rgArgs.push("-c")
        }

        if (headLimit > 0 && outputMode !== "count") {
          rgArgs.push("--max-count", String(headLimit))
        }

        rgArgs.push(args.pattern, searchPath)

        const output = await runRg(rgArgs, cwd)

        if (!output) {
          return "No matches found."
        }

        return output
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  return { stp_grep: grep }
}
