import type { Hooks } from "@opencode-ai/plugin"
import type { JianweiMonitor } from "./hooks/jianwei-monitor"

/**
 * Hook composition factory.
 *
 * Wraps the raw plugin hooks with enrichment layers:
 *   1. 国家监委 heartbeat monitoring — injects stall detection into the
 *      event hook to track workgroup task liveness.
 *   2. (Phase 5+) ToolGuard hooks (self-review checks)
 *   3. (Phase 5+) Transform hooks (workgroup context injector)
 *   4. (Phase 5+) Continuation hooks
 *   5. (Phase 5+) Skill hooks (skill auto-reminder)
 *
 * When no monitor is provided the hooks are returned as-passed.
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
