/**
 * Skill write tool — creates SKILL.md files from ministry learning output.
 *
 * Layout: ~/.servethepeople/skills/{skill-name}/SKILL.md
 * Format: YAML frontmatter + markdown body.
 */
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { SKILLS_ROOT_GLOBAL } from "../../shared/paths"
import { loadSkills, clearSkillCache, type Skill } from "../../shared/skill-loader"

function generateFrontmatter(skill: Omit<Skill, "body">): string {
  const lines = [
    "---",
    `name: "${skill.name}"`,
    `description: "${skill.description}"`,
    skill.triggers.length > 0 ? `triggers: [${skill.triggers.map(t => `"${t}"`).join(", ")}]` : "",
    skill.rules.length > 0 ? `rules: [${skill.rules.map(r => `"${r}"`).join(", ")}]` : "",
    skill.source ? `source: "${skill.source}"` : "",
    "---",
    "",
  ]
  return lines.filter(Boolean).join("\n")
}

export function createSkillWriteTool(): ToolDefinition {
  return tool({
    description:
      "创建或更新 Skill。将部委学习红头文件后提炼的技能写入全局存储（~/.servethepeople/skills/）。",
    args: {
      name: tool.schema.string()
        .describe("Skill 名称（kebab-case，如 jwt-config-no-hardcode）"),
      description: tool.schema.string()
        .describe("Skill 一句话描述"),
      triggers: tool.schema.array(tool.schema.string()).optional()
        .describe("触发条件列表（什么时候自动加载这个 skill）"),
      rules: tool.schema.array(tool.schema.string()).optional()
        .describe("规则列表（必须遵守的规定）"),
      source: tool.schema.string()
        .describe("来源红头文件编号（必填，如 国发〔2026〕1号）"),
      body: tool.schema.string()
        .describe("Skill 正文（Markdown，含操作步骤、注意事项、示例）"),
    },
    execute: async (args) => {
      const name = args.name as string
      const description = args.description as string
      const triggers = (args.triggers as string[]) ?? []
      const rules = (args.rules as string[]) ?? []
      const source = args.source as string | undefined
      const body = args.body as string

      if (!name.match(/^[a-z0-9-]+$/)) {
        return "错误：skill name 必须是 kebab-case（小写字母、数字、连字符）"
      }
      if (!source) {
        return "错误：source（红头文件编号）必须提供。如: 国发〔2026〕1号"
      }

      const skillDir = join(SKILLS_ROOT_GLOBAL, name)
      mkdirSync(skillDir, { recursive: true })

      const frontmatter = generateFrontmatter({ name, description, triggers, rules, source })
      const filePath = join(skillDir, "SKILL.md")
      writeFileSync(filePath, frontmatter + body, "utf-8")

      // Invalidate loader cache so next task picks it up
      clearSkillCache()

      return `✅ Skill 已写入: ${name}\n路径: ${filePath}\n\n下次任务组建工作组时将自动加载。`
    },
  })
}

export function createSkillListTool(workspaceRoot: string): ToolDefinition {
  return tool({
    description:
      "列出所有可用 Skill（全局 + 项目级）。用于组建工作组时预加载相关 Skill。",
    args: {
      query: tool.schema.string().optional()
        .describe("过滤关键词（匹配名称和描述）"),
    },
    execute: async (args) => {
      const query = (args.query as string) ?? ""
      const skills = loadSkills(workspaceRoot)

      const filtered = query
        ? skills.filter(s =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.description.toLowerCase().includes(query.toLowerCase())
          )
        : skills

      if (filtered.length === 0) {
        return query ? `未找到匹配 "${query}" 的 Skill。` : "暂无 Skill。部署新任务并完成学习闭环后自动生成。"
      }

      return filtered.map(s => {
        const meta = [
          s.source ? `来源: ${s.source}` : "",
          s.triggers.length > 0 ? `触发: ${s.triggers.join(", ")}` : "",
        ].filter(Boolean).join(" | ")
        return `- **${s.name}**: ${s.description}${meta ? ` (${meta})` : ""}`
      }).join("\n")
    },
  })
}
