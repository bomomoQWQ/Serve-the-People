import type { Hooks } from "@opencode-ai/plugin"
import type { JianweiMonitor } from "./hooks/jianwei-monitor"

/**
 * Hook composition factory.
 * Wraps the raw plugin hooks with enrichment layers,
 * currently only 国家监委 heartbeat monitoring.
 */
export function createHooks(
  hooks: Hooks,
  monitor?: JianweiMonitor,
): Hooks {
  if (!monitor) return hooks

  const originalEvent = hooks.event

  return {
    ...hooks,
    event: originalEvent
      ? async (input) => {
          // Inject 国家监委 monitoring before the original handler
          monitor.onEvent(input.event)
          await originalEvent(input)
        }
      : async (input) => {
          monitor.onEvent(input.event)
        },
  }
}
