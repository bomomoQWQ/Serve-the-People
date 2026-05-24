/**
 * Workgroup idle-wake handler — session.idle event handler.
 *
 * When a workgroup member session goes idle:
 *   1. Looks up the member in the session registry
 *   2. Checks the member's mailbox for new messages
 *   3. If found, sends a "wake" prompt to the session
 *
 * The wake prompt triggers a new turn, during which the
 * mailbox-injector hook will inject the actual messages.
 */

import { lookupSession } from "../features/workgroup/session-registry"
import { pollInbox } from "../features/workgroup/mailbox"

function buildWakeHint(count: number): string {
  return `[系统]\n你的信箱有 ${count} 条新工作组消息。新的消息将在当前轮次通过 mailbox 注入。请查看并处理。`
}

function buildWakeBatchKey(teamId: string, agent: string, messageIds: string[]): string {
  return `${teamId}:${agent}:${[...messageIds].sort().join(",")}`
}

const WAKE_HINT_SUPPRESS_MS = 30_000

interface WakeContext {
  client: {
    session?: {
      prompt: (opts: {
        path: { id: string }
        body: { agent?: string; parts: Array<{ type: "text"; text: string }> }
      }) => Promise<{ data?: unknown; error?: unknown }>
    }
  }
}

export function createWorkgroupIdleWake(ctx: WakeContext) {
  const recentWakeHints = new Map<string, number>()
  const jianweiTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const jianweiLastWake = new Map<string, number>()

  return async (sessionId: string): Promise<void> => {
    const member = lookupSession(sessionId)
    if (!member) return

    if (member.agent === "guowuyuan") return

    const messages = pollInbox(member.teamIds[0], member.agent)

    // 监委：即使无消息也定时唤醒，用 setTimeout 兜底避免 idle 只触发一次
    if (member.agent === "jianwei") {
      const scheduleNext = (delay: number) => {
        const existing = jianweiTimers.get(sessionId)
        if (existing) clearTimeout(existing)
        const t = setTimeout(() => {
          jianweiTimers.delete(sessionId)
          ctx.client.session?.prompt?.({
            path: { id: sessionId },
            body: {
              agent: member.agent,
              parts: [{ type: "text", text: "请检查工作组当前状态（stp_workgroup_status）。状态无变化不报告，只报告异常。" }],
            },
          })?.catch(() => {})
        }, delay)
        jianweiTimers.set(sessionId, t)
      }

      // Wake every 60s, regardless of messages
      const lastWake = jianweiLastWake.get(sessionId) ?? 0
      if (messages.length > 0) {
        // Has messages — wake now, reset timer
        jianweiLastWake.set(sessionId, Date.now())
        scheduleNext(60_000)
        return
      }
      const elapsed = Date.now() - lastWake
      if (elapsed >= 60_000) {
        jianweiLastWake.set(sessionId, Date.now())
        scheduleNext(60_000)
        if (ctx.client.session?.prompt) {
          await ctx.client.session.prompt({
            path: { id: sessionId },
            body: {
              agent: member.agent,
              parts: [{ type: "text", text: "请检查工作组当前状态（stp_workgroup_status）。状态无变化不报告，只报告异常。" }],
            },
          })
        }
        return
      }
      // Not yet time — schedule for remaining time
      scheduleNext(60_000 - elapsed)
      return
    }

    if (messages.length === 0) return

    // Deduplicate: don't repeatedly wake for the same message batch
    const batchKey = buildWakeBatchKey(
      member.teamIds[0],
      member.agent,
      messages.map((m) => m.messageId),
    )
    const suppressedUntil = recentWakeHints.get(batchKey)
    const now = Date.now()
    if (suppressedUntil !== undefined && suppressedUntil > now) return

    // Send wake prompt to the idle session
    if (ctx.client.session?.prompt) {
      await ctx.client.session.prompt({
        path: { id: sessionId },
        body: {
          agent: member.agent,
          parts: [{ type: "text", text: buildWakeHint(messages.length) }],
        },
      })
      recentWakeHints.set(batchKey, now + WAKE_HINT_SUPPRESS_MS)
    }
  }
}
