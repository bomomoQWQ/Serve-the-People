/**
 * Workgroup session registry — in-memory sessionID → workgroup member mapping.
 * Supports one session in multiple workgroups (e.g. 国务院跨组调度).
 */
export interface SessionEntry {
  teamIds: string[]
  agent: string
  memberName: string
}

const registry = new Map<string, SessionEntry>()

export function registerSession(sessionId: string, entry: SessionEntry): void {
  const existing = registry.get(sessionId)
  if (existing) {
    for (const tid of entry.teamIds) {
      if (!existing.teamIds.includes(tid)) existing.teamIds.push(tid)
    }
  } else {
    registry.set(sessionId, entry)
  }
}

export function unregisterSession(sessionId: string): void {
  registry.delete(sessionId)
}

export function lookupSession(sessionId: string): SessionEntry | undefined {
  return registry.get(sessionId)
}

export function findSessionByMember(teamId: string, agent: string): string | undefined {
  for (const [sid, entry] of registry) {
    if (entry.teamIds.includes(teamId) && entry.agent === agent) return sid
  }
  return undefined
}

/** Find all session IDs registered for a given team. */
export function findSessionsByTeam(teamId: string): string[] {
  const ids: string[] = []
  for (const [sid, entry] of registry) {
    if (entry.teamIds.includes(teamId)) ids.push(sid)
  }
  return ids
}
