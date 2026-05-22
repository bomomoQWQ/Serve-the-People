/**
 * Background task notification — stores pending notifications on child idle,
 * injected into parent session via chat.message hook.
 */
import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

function log(msg: string): void {
  try {
    const dir = ".servethepeople"
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, "debug.log"), `[${new Date().toISOString()}] [bg] ${msg}\n`)
  } catch { /* */ }
}

interface BackgroundEntry {
  sessionId: string
  parentSessionId: string
  agent: string
}

const registry = new Map<string, BackgroundEntry>()
const pending = new Map<string, string[]>()

export function registerBackgroundTask(entry: BackgroundEntry): void {
  registry.set(entry.sessionId, entry)
  log(`registered: child=${entry.sessionId.slice(0,8)} parent=${entry.parentSessionId.slice(0,8)} agent=${entry.agent}`)
}

export function handleBackgroundTaskIdle(_client: unknown, sessionId: string): void {
  const entry = registry.get(sessionId)
  if (!entry) {
    log(`idle IGNORED: sessionId=${sessionId.slice(0,8)} not in registry (${registry.size} entries)`)
    return
  }

  registry.delete(sessionId)
  log(`idle MATCHED: child=${sessionId.slice(0,8)} parent=${entry.parentSessionId.slice(0,8)}`)

  const text = `${entry.sessionId.slice(0,8)}: ${entry.agent}`
  const list = pending.get(entry.parentSessionId) ?? []
  list.push(text)
  pending.set(entry.parentSessionId, list)
  log(`pending queued for parent=${entry.parentSessionId.slice(0,8)} (${list.length} items)`)
}

export function injectPendingNotifications(sessionId: string): string | null {
  const list = pending.get(sessionId)
  if (!list || list.length === 0) return null

  pending.delete(sessionId)
  log(`INJECTING ${list.length} notifications into parent=${sessionId.slice(0,8)}`)

  return `<system-reminder>
[ALL BACKGROUND TASKS COMPLETE]

**Completed:**
${list.join("\n")}

Use \`stp_background_output(task_id="<id>")\` to retrieve each result.
</system-reminder>`
}
