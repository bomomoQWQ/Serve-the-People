import { tool, type ToolDefinition, type ToolContext } from "@opencode-ai/plugin/tool"
import {
  loadSkills,
  getSkillByName,
  getBuiltinSkill,
  BUILTIN_SKILLS,
  type Skill,
  type BuiltinSkillDef,
} from "../../shared/skill-loader"

const TOOL_DESCRIPTION = `Load a skill or execute a slash command to get detailed instructions for a specific task.

Skills and commands provide specialized knowledge and step-by-step guidance.
Use this when a task matches an available skill's or command's description.

**How to use:**
- Call with a skill name: name='review-work'
- Call with a command name (without leading slash): name='publish'
- The tool will return detailed instructions with your context applied.`

/**
 * Format available skills for the description getter.
 */
function formatAvailableItems(cwd: string): string {
  const fileSkills = loadSkills(cwd)
  const items: string[] = []

  // Built-in skills first
  items.push("### Built-in Skills")
  for (const s of BUILTIN_SKILLS) {
    items.push(`- \`${s.name}\`: ${s.description.slice(0, 80)}`)
  }

  // File-based skills
  if (fileSkills.length > 0) {
    items.push("")
    items.push("### Project Skills")
    for (const s of fileSkills) {
      items.push(`- \`${s.name}\`: ${s.description.slice(0, 80)}`)
    }
  }

  return items.join("\n")
}

/**
 * Find a matching skill by name from file-based skills,
 * with partial/fuzzy matching fallback.
 */
function findSkill(name: string, cwd: string): Skill | BuiltinSkillDef | undefined {
  // Exact match on file skills first (project > builtin)
  const fileSkill = getSkillByName(name, cwd)
  if (fileSkill) return fileSkill

  // Exact match on builtin skills
  const builtin = getBuiltinSkill(name)
  if (builtin) return builtin

  // Partial match (case-insensitive substring) on file skills
  const fileSkills = loadSkills(cwd)
  const partialFile = fileSkills.find(
    (s) => s.name.toLowerCase().includes(name.toLowerCase()),
  )
  if (partialFile) return partialFile

  // Partial match on builtin skills
  const partialBuiltin = BUILTIN_SKILLS.find(
    (s) => s.name.toLowerCase().includes(name.toLowerCase()),
  )
  if (partialBuiltin) return partialBuiltin

  return undefined
}

/**
 * Get the body content from a skill (unified interface).
 */
function getSkillBody(skill: Skill | BuiltinSkillDef): string {
  return skill.body
}

/**
 * Get the skill name (unified interface).
 */
function getSkillName(skill: Skill | BuiltinSkillDef): string {
  return skill.name
}

export function createSkillTool(): ToolDefinition {
  return tool({
    description: TOOL_DESCRIPTION,
    args: {
      name: tool.schema.string().describe(
        "The skill or command name (e.g., 'review-work' or 'publish'). Use without leading slash for commands.",
      ),
      user_message: tool.schema.string().optional().describe(
        "Optional arguments or context for command invocation. Example: name='publish', user_message='patch'",
      ),
    },
    execute: async (args, context: ToolContext) => {
      const cwd = context.directory
      const requestedName = (args.name as string).replace(/^\//, "")
      const matched = findSkill(requestedName, cwd)

      if (!matched) {
        const available = [
          ...BUILTIN_SKILLS.map((s) => s.name),
          ...loadSkills(cwd).map((s) => s.name),
        ].join(", ")
        return `Skill "${requestedName}" not found. Available: ${available || "none"}`
      }

      const body = getSkillBody(matched)
      const name = getSkillName(matched)

      return [
        `## Skill: ${name}`,
        "",
        body,
      ].join("\n")
    },
  })
}
