import { z } from "zod"

/** MCP configuration — maps built-in MCP names to enabled/disabled */
export const McpConfigSchema = z.object({
  websearch: z.boolean().default(true),
  context7: z.boolean().default(true),
  grep_app: z.boolean().default(true),
    lsp: z.boolean().default(false),
    ast_grep: z.boolean().default(false),
}).partial().default({})

/** Skill configuration */
export const SkillConfigSchema = z.object({
  /** Whether to enable file-based skill loading from .servethepeople/skills/ */
  enabled: z.boolean().default(true),
  /** Additional skill directories to scan */
  extraDirs: z.array(z.string()).default([]),
}).partial().default({})

/** Agent model override */
const AgentOverrideSchema = z.object({
  model: z.string().optional(),
}).partial()

/** Plugin configuration schema */
export const ServeThePeopleConfigSchema = z.object({
  /** Enable debug logging */
  debug: z.boolean().default(false),
  /** Agent model overrides */
  agents: z.record(z.string(), AgentOverrideSchema).default({}),
  /** MCP service toggles */
  mcp: McpConfigSchema,
  /** Skill loading configuration */
  skills: SkillConfigSchema,
})

export type ServeThePeopleConfig = z.infer<typeof ServeThePeopleConfigSchema>

/** Default config values */
export const DEFAULT_CONFIG: ServeThePeopleConfig = {
  debug: false,
  agents: {},
  mcp: {
    websearch: true,
    context7: true,
    grep_app: true,
    lsp: false,
    ast_grep: false,
  },
  skills: {
    enabled: true,
    extraDirs: [],
  },
}
