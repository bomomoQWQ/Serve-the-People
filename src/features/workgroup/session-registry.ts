/**
 * Workgroup session registry — in-memory sessionID → workgroup member mapping.
 *
 * Hooks (mailbox-injector, idle-wake) use this to determine if a session is
 * a workgroup member, and which team/agent it belongs to.
 *
 * Memory-only: lost on plugin restart. Acceptable because workgroup sessions
 * are ephemeral — on restart all sessions would be terminated by OpenCode anyway.
 */
export interface SessionEntry {
  teamId: string
  agent: string
  /** Human-readable member role (e.g. "工信部-编码") */
  memberName: string
}

const registry = new Map<string, SessionEntry>()

/** Register a workgroup member session */
export function registerSession(sessionId: string, entry: SessionEntry): void {
  registry.set(sessionId, entry)
}

/** Unregister a workgroup member session (e.g. on session delete) */
export function unregisterSession(sessionId: string): void {
  registry.delete(sessionId)
}

/** Look up workgroup membership by session ID */
export function lookupSession(sessionId: string): SessionEntry | undefined {
  return registry.get(sessionId)
}
