/**
 * Background task notification — injects <system-reminder> into parent session
 * when a stp_task(run_in_background=true) child session completes.
 *
 * Simple version of oh-my-openagent's BackgroundManager notification system.
 */
import type { PluginInput } from "@opencode-ai/plugin"

interface BackgroundEntry {
  sessionId: string
  parentSessionId: string
  agent: string
}

const registry = new Map<string, BackgroundEntry>()

/** Register a background task launch */
export function registerBackgroundTask(entry: BackgroundEntry): void {
  registry.set(entry.sessionId, entry)
}

/** Handle session.idle — check if it's a background task and notify parent */
export async function handleBackgroundTaskIdle(
  client: PluginInput["client"],
  sessionId: string,
): Promise<void> {
  const entry = registry.get(sessionId)
  if (!entry) return

  try {
    // Wait a moment for session to settle
    await new Promise(r => setTimeout(r, 1000))

    // Check if child session has output
    const msgs = await (client.session as unknown as Record<string, Function>)?.messages?.({ path: { id: sessionId } })
    if (!msgs?.data || msgs.data.length === 0) return

    let hasOutput = false
    for (let j = (msgs.data as Array<{ info?: { role?: string } }>).length - 1; j >= 0; j--) {
      if (msgs.data[j]?.info?.role === "assistant") {
        hasOutput = true
        break
      }
    }
    if (!hasOutput) return

    const notification = `<system-reminder>
[BACKGROUND TASK COMPLETE]
**ID:** \`${entry.sessionId}\`
**Agent:** ${entry.agent}

Use \`stp_background_output(task_id="${entry.sessionId}")\` to retrieve result.
</system-reminder>`

    // Try promptAsync first (non-blocking), fall back to prompt
    const sessionApi = client.session as unknown as Record<string, Function> | undefined
    const promptFn = sessionApi?.promptAsync ?? sessionApi?.prompt
    if (!promptFn) return

    await promptFn({
      path: { id: entry.parentSessionId },
      body: { parts: [{ type: "text", text: notification }] },
    })

    registry.delete(sessionId)
  } catch (e) {
    // If notification injection fails, keep entry for retry on next idle
    console.warn(`[serve-the-people] Background notification failed for ${sessionId}: ${String(e)}`)
  }
}
