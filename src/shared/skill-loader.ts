/**
 * Simple skill loader for Serve the People plugin.
 *
 * Scans .servethepeople/skills/ directory for SKILL.md files with
 * YAML frontmatter. Caches loaded skills in memory.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"

export interface Skill {
  name: string
  description: string
  triggers: string[]
  rules: string[]
  source?: string
  /** Raw markdown body (without frontmatter) */
  body: string
}

interface FrontmatterResult {
  data: Record<string, unknown>
  body: string
}

/**
 * Parse YAML frontmatter from markdown content.
 * Handles the common `---\n...\n---\n` format with simple key: value parsing.
 */
function parseFrontmatter(content: string): FrontmatterResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { data: {}, body: content }
  }

  const yamlContent = match[1]
  const body = match[2]

  try {
    const data = parseSimpleYaml(yamlContent)
    return { data, body }
  } catch {
    return { data: {}, body }
  }
}

/**
 * Minimal YAML parser for simple key-value pairs.
 * Supports:
 *   - key: value (string)
 *   - key: [val1, val2] (array)
 *   - quoted strings: "value" or 'value'
 * Does NOT support nesting or complex YAML features.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split(/\r?\n/)
  let multilineKey: string | null = null
  let multilineValue = ""

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) continue

    // Handle continuation of multiline strings
    if (multilineKey !== null) {
      if (line.match(/^\s{2,}/) || line.trim().startsWith("- ")) {
        multilineValue += "\n" + line
        continue
      } else {
        // End of multiline, store it
        result[multilineKey] = multilineValue.trim()
        multilineKey = null
        multilineValue = ""
        // Fall through to process this line normally
      }
    }

    const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/)
    if (!kvMatch) continue

    const key = kvMatch[1].trim()
    const rawValue = kvMatch[2].trim()

    // Quoted string
    const quotedMatch = rawValue.match(/^["'](.+)["']$/)
    if (quotedMatch) {
      result[key] = quotedMatch[1]
      continue
    }

    // Array: [item1, item2, ...]
    const arrayMatch = rawValue.match(/^\[([^\]]*)\]$/)
    if (arrayMatch) {
      result[key] = arrayMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
      continue
    }

    // Multiline indicator: value is "|" or empty trailing quote
    if (rawValue === "|") {
      multilineKey = key
      multilineValue = ""
      continue
    }

    // Boolean
    if (rawValue === "true" || rawValue === "false") {
      result[key] = rawValue === "true"
      continue
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      result[key] = Number(rawValue)
      continue
    }

    // Plain string
    result[key] = rawValue
  }

  // Store any trailing multiline value
  if (multilineKey !== null) {
    result[multilineKey] = multilineValue.trim()
  }

  return result
}

let skillCache: Skill[] | null = null

/**
 * Scan the skill directories for SKILL.md files.
 * Searches project-level: .servethepeople/skills/
 */
export function loadSkills(workspaceRoot: string): Skill[] {
  if (skillCache) return skillCache

  const skills: Skill[] = []
  const skillsDir = join(workspaceRoot, ".servethepeople", "skills")

  if (!existsSync(skillsDir)) {
    skillCache = skills
    return skills
  }

  try {
    const entries = readdirSync(skillsDir)
    for (const entry of entries) {
      const skillPath = join(skillsDir, entry)
      const skillMdPath = join(skillPath, "SKILL.md")

      if (!existsSync(skillMdPath)) continue

      try {
        const stat = statSync(skillPath)
        if (!stat.isDirectory()) continue

        const content = readFileSync(skillMdPath, "utf-8")
        const { data, body } = parseFrontmatter(content)

        const name = (data.name as string) || entry
        const description = (data.description as string) || ""
        const triggers = parseSkillArray(data.triggers)
        const rules = parseSkillArray(data.rules)
        const source = data.source as string | undefined

        skills.push({
          name,
          description,
          triggers,
          rules,
          source,
          body,
        })
      } catch {
        // Skip broken skill files
      }
    }
  } catch {
    // Directory might not be readable
  }

  skillCache = skills
  return skills
}

function parseSkillArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v))
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

/** Clear the skill cache (for testing) */
export function clearSkillCache(): void {
  skillCache = null
}

/** Get a specific skill by name from the loaded cache */
export function getSkillByName(
  name: string,
  workspaceRoot: string,
): Skill | undefined {
  const skills = loadSkills(workspaceRoot)
  return skills.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  )
}

/** All built-in skills baked into the plugin */
export interface BuiltinSkillDef {
  name: string
  description: string
  body: string
}

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  {
    name: "playwright",
    description:
      "MUST USE for any browser-related tasks. Browser automation via Playwright MCP - verification, browsing, information gathering, web scraping, testing, screenshots, and all browser interactions.",
    body: `# Playwright Skill

## OVERVIEW
Browser automation via Playwright MCP. Use for verification, browsing, web scraping, testing, screenshots.

## KEY BEHAVIORS
- All browser interaction goes through Playwright MCP tools
- Take screenshots for visual verification
- Navigate and extract data programmatically

## MCP TOOLS
Available via skill_mcp with mcp_name="playwright":
  - browser_navigate
  - browser_click
  - browser_snapshot
  - browser_take_screenshot
  - browser_evaluate
`,
  },
  {
    name: "git-master",
    description:
      "MUST USE for ANY git operations. Atomic commits, rebase/squash, history search (blame, bisect, log -S).",
    body: `# Git Master Skill

## OVERVIEW
Handles all git operations with atomic commits, clean history, and proper rebase workflows.

## KEY BEHAVIORS
- Atomic commits: each commit addresses ONE logical change
- Rebase/squash before pushing: clean up WIP commits
- History search: use blame, bisect, and log -S to trace changes

## GUIDELINES
- Never force-push to shared branches
- Write concise commit messages that match repo style
- Inspect git status/diff/log before committing
- Stage only intended files; never commit secrets
`,
  },
  {
    name: "review-work",
    description:
      "Post-implementation review orchestrator. Launches 5 parallel background sub-agents. All must pass for review to pass.",
    body: `# Review Work Skill

## OVERVIEW
Post-implementation review orchestrator. Launches 5 parallel background sub-agents to review changes from multiple angles.

## REVIEW AGENTS
1. Oracle (goal/constraint verification) - verifies implementation meets original goals
2. Oracle (code quality) - checks code style, patterns, maintainability
3. Oracle (security) - scans for vulnerabilities, secret leaks, unsafe patterns
4. QA executor - runs tests, manual verification scenarios
5. Context miner - searches GitHub/git/Slack/Notion for related context

## WORKFLOW
1. Launch all 5 agents in parallel using background tasks
2. Collect results via background_output
3. All 5 must pass for review to pass
4. Fix any issues found, then re-review

Triggers: 'review work', 'review my work', 'review changes', 'QA my work',
'verify implementation', 'check my work', 'validate changes'
`,
  },
  {
    name: "frontend-ui-ux",
    description:
      "Designer-turned-developer who crafts stunning UI/UX even without design mockups",
    body: `# Frontend UI/UX Skill

## OVERVIEW
Crafts polished, production-quality frontends without needing design mockups. Applies design principles, accessibility standards, and modern CSS patterns.

## KEY PRINCIPLES
- Visual hierarchy: clear information architecture through spacing and typography
- Color theory: harmonious palettes with proper contrast ratios (WCAG AA minimum)
- Responsive design: mobile-first with progressive enhancement
- Motion: subtle, purposeful animations (prefers-reduced-motion aware)
- Dark mode: automatic detection and manual toggle support

## TYPICAL OUTPUT
- Component reimplementation with proper spacing, colors, and responsive breakpoints
- CSS-in-JS or Tailwind classes depending on project setup
- Storybook stories for component variants
`,
  },
  {
    name: "ai-slop-remover",
    description:
      "Removes AI-generated code smells from a SINGLE file while preserving functionality. For multiple files, call in PARALLEL per file.",
    body: `# AI Slop Remover Skill

## OVERVIEW
Removes common AI-generated code patterns (slop) from a file while preserving functionality.

## WHAT TO REMOVE
- Redundant comments that restate obvious code
- Overly verbose variable names
- Unnecessary type annotations where type inference suffices
- Dead code and unreachable branches
- Over-engineered abstractions (simplify where possible)
- AI filler words in docstrings ("simply", "obviously", "clearly")

## WHAT TO PRESERVE
- Public API signatures
- Test expectations
- Error handling logic
- Performance optimizations
- Security-related checks

## WORKFLOW
1. Read the file
2. Identify AI slop patterns
3. Apply targeted edits
4. Verify tests still pass
5. For multiple files: launch parallel background tasks per file
`,
  },
]

/**
 * Find a built-in skill by name.
 */
export function getBuiltinSkill(name: string): BuiltinSkillDef | undefined {
  return BUILTIN_SKILLS.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  )
}
