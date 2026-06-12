import type { AgentConfig } from "@opencode-ai/sdk"

/** Agent visibility mode */
export type AgentMode = "primary" | "subagent" | "all"

/** Factory function signature — must have static .mode property */
export type AgentFactory = ((model: string) => AgentConfig) & { mode: AgentMode }

/** Permission value for individual tools */
export type PermissionValue = "ask" | "allow" | "deny"

/** Tool restriction helper: create deny/allow map per OpenCode 1.1.1+ format */
export function createAgentToolRestrictions(
  denyTools: string[],
  allowTools?: string[],
): { permission: Record<string, PermissionValue> } {
  const permission: Record<string, PermissionValue> = {}
  for (const t of denyTools) permission[t] = "deny"
  if (allowTools) {
    for (const t of allowTools) permission[t] = "allow"
  }
  return { permission }
}

/** Model guard: check if model name matches a family */
export function isGptModel(model?: string): boolean {
  return !!model && /^(gpt|o1|o3|o4)/i.test(model)
}

/** Export all types for barrel */
export type { AgentConfig }
