import type { ServeThePeopleConfig } from "./config"
import { ServeThePeopleConfigSchema, DEFAULT_CONFIG } from "./config"
import { existsSync, readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const CONFIG_BASENAME = "serve-the-people"

/**
 * Load and validate plugin configuration.
 *
 * Search order (closer wins):
 *   1. ${workspaceRoot}/.opencode/${CONFIG_BASENAME}.jsonc  (project-level)
 *   2. ~/.config/opencode/${CONFIG_BASENAME}.jsonc          (user-level)
 *   3. Built-in defaults
 */
export function loadPluginConfig(workspaceRoot?: string): ServeThePeopleConfig {
  let userConfig: Partial<ServeThePeopleConfig> = {}
  let projectConfig: Partial<ServeThePeopleConfig> = {}

  // Load user-level config
  const userConfigDir = join(homedir(), ".config", "opencode")
  const userConfigPath = join(userConfigDir, `${CONFIG_BASENAME}.jsonc`)
  if (existsSync(userConfigPath)) {
    userConfig = loadJsoncConfig(userConfigPath) ?? {}
  }

  // Load project-level config (overrides user config)
  if (workspaceRoot) {
    const projectConfigPath = join(workspaceRoot, ".opencode", `${CONFIG_BASENAME}.jsonc`)
    if (existsSync(projectConfigPath)) {
      projectConfig = loadJsoncConfig(projectConfigPath) ?? {}
    }
  }

  // Merge: defaults < user < project
  const merged: ServeThePeopleConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    ...projectConfig,
    agents: {
      ...DEFAULT_CONFIG.agents,
      ...(userConfig.agents ?? {}),
      ...(projectConfig.agents ?? {}),
    },
    mcp: {
      ...DEFAULT_CONFIG.mcp,
      ...(userConfig.mcp ?? {}),
      ...(projectConfig.mcp ?? {}),
    },
    skills: {
      ...DEFAULT_CONFIG.skills,
      ...(userConfig.skills ?? {}),
      ...(projectConfig.skills ?? {}),
    },
  }

  const result = ServeThePeopleConfigSchema.safeParse(merged)
  if (!result.success) {
    console.warn(`[serve-the-people] Config validation warning: ${result.error.message}`)
    return DEFAULT_CONFIG
  }
  return result.data
}

/** Load and parse a JSONC config file (supports // comments). */
function loadJsoncConfig(path: string): Partial<ServeThePeopleConfig> | null {
  try {
    const raw = readFileSync(path, "utf-8")
    // Strip comments (JSONC: // and /* */)
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")  // block comments
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))  // line comments
      .join("\n")
    return JSON.parse(stripped) as Partial<ServeThePeopleConfig>
  } catch {
    return null
  }
}

/** Create a default config file if it doesn't exist. */
export function ensureDefaultConfig(workspaceRoot?: string): void {
  if (!workspaceRoot) return
  const configDir = join(workspaceRoot, ".opencode")
  const configPath = join(configDir, `${CONFIG_BASENAME}.jsonc`)
  if (existsSync(configPath)) return

  try {
    mkdirSync(configDir, { recursive: true })
    const defaultContent = JSON.stringify(DEFAULT_CONFIG, null, 2)
      .replace(/\n/g, "\n")
    const { writeFileSync } = require("node:fs") as typeof import("node:fs")
    writeFileSync(configPath, `// ${CONFIG_BASENAME} plugin configuration\n${defaultContent}\n`, "utf-8")
  } catch {
    // Optional — don't block plugin init for this
  }
}
