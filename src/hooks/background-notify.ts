/**
 * Background task notification — stores pending notifications on child idle,
 * injected into parent session via chat.message hook.
 *
 * Cross-session promptAsync from session.idle handler is unreliable.
 * Instead, queue notifications and inject them when the parent sends
 * its next chat.message.
 */
interface BackgroundEntry {
  sessionId: string
  parentSessionId: string
  agent: string
  description?: string
}

const registry = new Map<string, BackgroundEntry>()
const pending = new Map<string, string[]>()

export function registerBackgroundTask(entry: BackgroundEntry): void {
  registry.set(entry.sessionId, entry)
}

export function handleBackgroundTaskIdle(_client: unknown, sessionId: string): void {
  const entry = registry.get(sessionId)
  if (!entry) return

  registry.delete(sessionId)

  const text = `- \`${entry.sessionId}\`: ${entry.description ?? entry.agent}`
  const parentId = entry.parentSessionId
  const list = pending.get(parentId) ?? []
  list.push(text)
  pending.set(parentId, list)
}

/** Inject pending notifications into parent chat context. Call from chat.message hook. */
export function injectPendingNotifications(sessionId: string): string | null {
  const list = pending.get(sessionId)
  if (!list || list.length === 0) return null

  pending.delete(sessionId)
  return `<system-reminder>
[ALL BACKGROUND TASKS COMPLETE]

**Completed:**
${list.join("\n")}

Use \`stp_background_output(task_id="<id>")\` to retrieve each result.
</system-reminder>`
}
