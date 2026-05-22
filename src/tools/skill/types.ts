/** Skill metadata interface matching the document schema */
export interface SkillInfo {
  name: string
  description: string
  triggers: string[]
  /** Source reference (e.g. red-head document) */
  source?: string
  rules: string[]
}

/** Arguments for the skill() tool */
export interface SkillArgs {
  name: string
  user_message?: string
}
