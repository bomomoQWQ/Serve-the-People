/**
 * Background task notification — pushes via promptAsync first,
 * falls back to pending map (injected by next chat.message).
 */
import type { PluginInput } from "@opencode-ai/plugin"

interface BackgroundEntry {
  sessionId: string
  parentSessionId: string
  agent: string
}

const registry = new Map<string, BackgroundEntry>()
const pending = new Map<string, string[]>()

export function registerBackgroundTask(entry: BackgroundEntry): void {
  registry.set(entry.sessionId, entry)
}

export async function handleBackgroundTaskIdle(
  client: PluginInput["client"],
  sessionId: string,
): Promise<void> {
  const entry = registry.get(sessionId)
  if (!entry) return

  registry.delete(sessionId)

  const text = `${entry.sessionId.slice(0,8)}: ${entry.agent}`
  const notification = `<system-reminder>
${entry.agent}的同志已完成任务。

**任务ID：** \`${entry.sessionId}\`

请用 \`stp_background_output(task_id="${entry.sessionId}")\` 收取报告。
</system-reminder>`

  // Wait for parent session to settle, then try push
  await new Promise(r => setTimeout(r, 2000))

  try {
    const api = client.session as unknown as { promptAsync?: (opts: unknown) => Promise<unknown> }
    if (api.promptAsync) {
      await api.promptAsync({
        path: { id: entry.parentSessionId },
        body: { parts: [{ type: "text", text: notification }] },
      })
      return
    }
  } catch { /* fall through to pending */ }

  // Fallback: queue for next chat.message
  const list = pending.get(entry.parentSessionId) ?? []
  list.push(text)
  pending.set(entry.parentSessionId, list)
}

export function injectPendingNotifications(sessionId: string): string | null {
  const list = pending.get(sessionId)
  if (!list || list.length === 0) return null

  pending.delete(sessionId)

  return `<system-reminder>
以下同志已完成任务：

${list.join("\n")}

请用 \`stp_background_output(task_id="<id>")\` 收取报告。
</system-reminder>`
}
