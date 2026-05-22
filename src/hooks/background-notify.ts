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

  // Check if child session has output
  try {
    const msgs = await client.session?.messages?.({ path: { id: sessionId } })
    if (!msgs?.data || msgs.data.length === 0) return

    // Find last assistant message
    let hasOutput = false
    for (let j = msgs.data.length - 1; j >= 0; j--) {
      if (msgs.data[j]?.info?.role === "assistant") {
        hasOutput = true
        break
      }
    }
    if (!hasOutput) return

    // Inject notification into parent session
    const notification = `<system-reminder>
[BACKGROUND TASK COMPLETE]
**ID:** \`${entry.sessionId}\`
**Agent:** ${entry.agent}

Use \`stp_background_output(task_id="${entry.sessionId}")\` to retrieve result.
</system-reminder>`

    await client.session?.prompt?.({
      path: { id: entry.parentSessionId },
      body: { parts: [{ type: "text", text: notification }] },
    })

    // Clean up registry
    registry.delete(sessionId)
  } catch {
    // Best effort — don't crash the idle handler
  }
}
