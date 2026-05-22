import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"

const SKILL_MCP_DESCRIPTION = `Invoke MCP server operations from skill-embedded MCPs. Requires mcp_name plus exactly one of: tool_name, resource_name, or prompt_name.`

/**
 * Built-in MCP names mapped to their corresponding native tool names.
 * When a user calls skill_mcp for one of these, we redirect to the native tool.
 */
const BUILTIN_MCP_TOOL_HINTS: Record<string, string[]> = {
  context7: ["context7_resolve-library-id", "context7_query-docs"],
  websearch: ["websearch_web_search_exa"],
  grep_app: ["grep_app_searchGitHub"],
}

function validateOperation(args: Record<string, unknown>): { type: "tool" | "resource" | "prompt"; name: string } {
  const ops: { type: "tool" | "resource" | "prompt"; name: string }[] = []
  if (args.tool_name) ops.push({ type: "tool", name: args.tool_name as string })
  if (args.resource_name) ops.push({ type: "resource", name: args.resource_name as string })
  if (args.prompt_name) ops.push({ type: "prompt", name: args.prompt_name as string })

  if (ops.length === 0) {
    throw new Error(
      "Missing operation. Exactly one of tool_name, resource_name, or prompt_name must be specified.\n\n" +
        "Examples:\n" +
        '  skill_mcp(mcp_name="sqlite", tool_name="query", arguments=\'{"sql": "SELECT * FROM users"}\')\n' +
        '  skill_mcp(mcp_name="memory", resource_name="memory://notes")\n' +
        '  skill_mcp(mcp_name="helper", prompt_name="summarize", arguments=\'{"text": "..."}\')',
    )
  }

  if (ops.length > 1) {
    const provided = [
      args.tool_name && `tool_name="${args.tool_name}"`,
      args.resource_name && `resource_name="${args.resource_name}"`,
      args.prompt_name && `prompt_name="${args.prompt_name}"`,
    ]
      .filter(Boolean)
      .join(", ")
    throw new Error(
      `Multiple operations specified. Exactly one of tool_name, resource_name, or prompt_name must be provided.\n\n` +
        `Received: ${provided}\n\n` +
        "Use separate calls for each operation.",
    )
  }

  return ops[0]
}

export function createSkillMcpTool(client: PluginInput["client"]): ToolDefinition {
  const api = client as unknown as Record<string, unknown> & {
    mcp?: {
      callTool?: (opts: { serverName: string; toolName: string; args: Record<string, unknown> }) => Promise<unknown>
      readResource?: (opts: { serverName: string; uri: string }) => Promise<unknown>
      getPrompt?: (opts: { serverName: string; promptName: string; args: Record<string, string> }) => Promise<unknown>
    }
  }

  return tool({
    description: SKILL_MCP_DESCRIPTION,
    args: {
      mcp_name: tool.schema.string().describe("Name of the MCP server from skill config"),
      tool_name: tool.schema.string().optional().describe("MCP tool to call"),
      resource_name: tool.schema.string().optional().describe("MCP resource URI to read"),
      prompt_name: tool.schema.string().optional().describe("MCP prompt to get"),
      arguments: tool.schema.union([tool.schema.string(), tool.schema.object({})]).optional()
        .describe("JSON string or object of arguments"),
      grep: tool.schema.string().optional()
        .describe("Regex pattern to filter output lines (only matching lines returned)"),
    },
    execute: async (args) => {
      try {
        const operation = validateOperation(args)

        const mcpName = args.mcp_name as string

        // Check if this is a built-in MCP and suggest native tools
        const nativeTools = BUILTIN_MCP_TOOL_HINTS[mcpName]
        if (nativeTools) {
          return (
            `"${mcpName}" is a built-in MCP, not a skill MCP.\n` +
            "Use the native tools directly:\n" +
            nativeTools.map((toolName) => `  - ${toolName}`).join("\n")
          )
        }

        // Attempt to call through client MCP API
        if (api.mcp?.callTool && operation.type === "tool") {
          try {
            const parsedArgs = parseArguments(args.arguments)
            const result = await api.mcp.callTool({
              serverName: mcpName,
              toolName: operation.name,
              args: parsedArgs,
            })
            const output = JSON.stringify(result, null, 2)
            return applyGrepFilter(output, args.grep as string | undefined)
          } catch (e) {
            return `Error calling MCP tool "${operation.name}" on "${mcpName}": ${e instanceof Error ? e.message : String(e)}`
          }
        }

        if (api.mcp?.readResource && operation.type === "resource") {
          try {
            const result = await api.mcp.readResource({
              serverName: mcpName,
              uri: operation.name,
            })
            const output = JSON.stringify(result, null, 2)
            return applyGrepFilter(output, args.grep as string | undefined)
          } catch (e) {
            return `Error reading MCP resource "${operation.name}" on "${mcpName}": ${e instanceof Error ? e.message : String(e)}`
          }
        }

        if (api.mcp?.getPrompt && operation.type === "prompt") {
          try {
            const parsedArgs = parseArguments(args.arguments)
            const stringArgs: Record<string, string> = {}
            for (const [key, value] of Object.entries(parsedArgs)) {
              stringArgs[key] = String(value)
            }
            const result = await api.mcp.getPrompt({
              serverName: mcpName,
              promptName: operation.name,
              args: stringArgs,
            })
            const output = JSON.stringify(result, null, 2)
            return applyGrepFilter(output, args.grep as string | undefined)
          } catch (e) {
            return `Error getting MCP prompt "${operation.name}" on "${mcpName}": ${e instanceof Error ? e.message : String(e)}`
          }
        }

        return (
          `MCP server "${mcpName}" not available for ${operation.type} operations.\n` +
          "Available built-in MCPs: context7, websearch, grep_app, lsp, ast_grep\n" +
          "Skill-embedded MCPs require the skill to be loaded first via the skill() tool."
        )
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

function parseArguments(args: unknown): Record<string, unknown> {
  if (!args) return {}
  if (typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  if (typeof args === "string") {
    try {
      return JSON.parse(args)
    } catch {
      return {}
    }
  }
  return {}
}

function applyGrepFilter(output: string, pattern: string | undefined): string {
  if (!pattern) return output
  try {
    const regex = new RegExp(pattern, "i")
    const lines = output.split("\n")
    const filtered = lines.filter((line) => regex.test(line))
    return filtered.length > 0
      ? filtered.join("\n")
      : `[grep] No lines matched pattern: ${pattern}`
  } catch {
    return output
  }
}
