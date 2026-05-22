/**
 * Background task notification — pushes via promptAsync first,
 * falls back to pending map (injected by next chat.message).
 */
import type { PluginInput } from "@opencode-ai/plugin"
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

export async function handleBackgroundTaskIdle(
  client: PluginInput["client"],
  sessionId: string,
): Promise<void> {
  const entry = registry.get(sessionId)
  if (!entry) {
    log(`idle IGNORED: sessionId=${sessionId.slice(0,8)} not in registry (${registry.size} entries)`)
    return
  }

  registry.delete(sessionId)
  log(`idle MATCHED: child=${sessionId.slice(0,8)} parent=${entry.parentSessionId.slice(0,8)}`)

  const text = `${entry.sessionId.slice(0,8)}: ${entry.agent}`
  const notification = `<system-reminder>
[ALL BACKGROUND TASKS COMPLETE]

**Completed:**
- \`${entry.sessionId}\`: ${entry.agent}

Use \`stp_background_output(task_id="${entry.sessionId}")\` to retrieve each result.
</system-reminder>`

  // Try push via promptAsync first
  try {
    const api = client.session as unknown as { promptAsync?: (opts: unknown) => Promise<unknown> }
    if (api.promptAsync) {
      await api.promptAsync({
        path: { id: entry.parentSessionId },
        body: { parts: [{ type: "text", text: notification }] },
      })
      log(`PUSHED to parent=${entry.parentSessionId.slice(0,8)}`)
      return
    }
  } catch {
    log(`push FAILED, falling back to pending for parent=${entry.parentSessionId.slice(0,8)}`)
  }

  // Fallback: queue for next chat.message
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
