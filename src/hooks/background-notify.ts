/**
 * Background task notification — injects <system-reminder> into parent session
 * when a stp_task(run_in_background=true) child session goes idle.
 */
import type { PluginInput } from "@opencode-ai/plugin"

interface BackgroundEntry {
  sessionId: string
  parentSessionId: string
  agent: string
}

const registry = new Map<string, BackgroundEntry>()

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

  const notification = `<system-reminder>
[BACKGROUND TASK COMPLETE]
**ID:** \`${entry.sessionId}\`
**Agent:** ${entry.agent}

Use \`stp_background_output(task_id="${entry.sessionId}")\` to retrieve result.
</system-reminder>`

  try {
    const api = client.session as unknown as { promptAsync?: (opts: { path: { id: string }; body: { parts: Array<{ type: string; text: string }> } }) => Promise<unknown> }
    if (api.promptAsync) {
      await api.promptAsync({
        path: { id: entry.parentSessionId },
        body: { parts: [{ type: "text", text: notification }] },
      })
    }
  } catch (e) {
    // Best effort
  }
}
