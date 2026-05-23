import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { runRg } from "../../shared/ripgrep-cli"

export function createGlobTools(): Record<string, ToolDefinition> {
  const glob: ToolDefinition = tool({
    description:
      "快速文件模式匹配（60s 超时，100 文件上限）。支持 glob 如 **/*.js。",
    args: {
      pattern: tool.schema.string().describe("The glob pattern to match files against"),
      path: tool.schema.string().optional().describe(
        "The directory to search in. If not specified, the current working directory will be used."
      ),
    },
    execute: async (args, context) => {
      try {
        const cwd = (context as Record<string, unknown>).directory as string | undefined
        const searchPath = args.path ?? "."

        // Use rg --files with --glob for pattern matching
        const rgArgs = ["--files", "--glob", args.pattern, searchPath]
        const output = await runRg(rgArgs, cwd)

        if (!output) {
          return "No files found matching pattern."
        }

        return output
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })

  return { stp_glob: glob }
}
