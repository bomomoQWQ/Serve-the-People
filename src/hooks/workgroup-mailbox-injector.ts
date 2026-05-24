/**
 * Workgroup mailbox injector — experimental.chat.messages.transform hook.
 *
 * On every turn of a workgroup member session, this hook:
 *   1. Checks if the current session is a registered workgroup member
 *   2. Reads the member's mailbox inbox
 *   3. Injects any unseen messages as synthetic user messages
 *
 * Injects messages BEFORE the last user message in the conversation array
 * so the member agent sees them as part of the current turn.
 */

import { lookupSession } from "../features/workgroup/session-registry"
import { pollInbox } from "../features/workgroup/mailbox"

type TransformParts = Array<{ type: string; text?: string }>

type TransformMessage = {
  info: { role: string; sessionID?: string }
  parts: TransformParts
}

function buildInjectionText(messages: Array<{ messageId: string; from: string; timestamp: string; body: string }>): string {
  return messages.map((m) => {
    const header = `[工作组消息] 来自: ${m.from} | 时间: ${m.timestamp} | ID: ${m.messageId}`
    return `${header}\n---\n${m.body}`
  }).join("\n\n")
}

function findLastUserMessageIndex(messages: TransformMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.info.role === "user") return i
  }
  return -1
}

export interface MailboxInjectorHook {
  "experimental.chat.messages.transform"?: (
    input: { sessionID?: string; [key: string]: unknown },
    output: { messages: TransformMessage[] },
  ) => Promise<void>
}

export function createWorkgroupMailboxInjector(): MailboxInjectorHook {
  // Track which message IDs each session has already injected
  const injectedCache = new Map<string, Set<string>>()

  return {
    "experimental.chat.messages.transform": async (input, output) => {
      const sessionId = input.sessionID
      if (!sessionId || output.messages.length === 0) return

      const member = lookupSession(sessionId)
      if (!member) return

      // 国务院不自动注入——自己用 stp_workgroup_message(poll) 手动查收
      if (member.agent === "guowuyuan") return

      const messages = pollInbox(member.teamIds[0], member.agent)
      if (messages.length === 0) return

      // Filter: only inject messages not yet seen by this session
      const seen = injectedCache.get(sessionId) ?? new Set()
      const newMessages = messages.filter((m) => !seen.has(m.messageId))
      if (newMessages.length === 0) return

      // Mark as seen
      for (const m of newMessages) seen.add(m.messageId)
      injectedCache.set(sessionId, seen)

      // Build and inject
      const text = buildInjectionText(newMessages)
      const injectedMsg: TransformMessage = {
        info: { role: "user" },
        parts: [{ type: "text", text }],
      }

      const lastUserIdx = findLastUserMessageIndex(output.messages)
      if (lastUserIdx === -1) {
        output.messages.unshift(injectedMsg)
      } else {
        output.messages.splice(lastUserIdx, 0, injectedMsg)
      }
    },
  }
}
