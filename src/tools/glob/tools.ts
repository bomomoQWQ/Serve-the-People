import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { runRg } from "../../shared/ripgrep-cli"

export function createGlobTools(): Record<string, ToolDefinition> {
  const glob: ToolDefinition = tool({
    description:
      "Fast file pattern matching tool with safety limits (60s timeout, 100 file limit). " +
      "Supports glob patterns like \"**/*.js\" or \"src/**/*.ts\". " +
      "Returns matching file paths sorted by modification time.",
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
