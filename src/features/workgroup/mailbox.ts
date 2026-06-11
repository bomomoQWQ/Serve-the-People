/**
 * 工作组 mailbox — simple file-based inter-agent messaging.
 * Replaces oh-my-openagent's team-mailbox (which uses file locking, reservation, etc.)
 * with a simpler version for the Serve the People workgroup model.
 *
 * Layout: .servethepeople/teams/{teamId}/mailbox/{recipientName}/
 *   - {messageId}.json — unread message
 *   - processed/{messageId}.json — acked message
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs"
import { join } from "node:path"
import { projectTeamsRoot } from "../../shared/paths"

export interface Message {
  messageId: string
  from: string
  to: string
  kind: "message" | "shutdown_request" | "announcement"
  body: string
  timestamp: string
}

let MAILBOX_DIR = ".servethepeople/teams"

/** Initialize mailbox path from workspace root. Call once during plugin init. */
export function initMailbox(basePath: string): void {
  MAILBOX_DIR = projectTeamsRoot(basePath)
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

/** Send a message to a recipient's inbox */
export function sendMessage(teamId: string, msg: Omit<Message, "messageId" | "timestamp">): Message {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const message: Message = { ...msg, messageId: id, timestamp: new Date().toISOString() }

  const inboxDir = join(MAILBOX_DIR, teamId, "mailbox", msg.to)
  ensureDir(inboxDir)

  const msgPath = join(inboxDir, `${id}.json`)
  writeFileSync(msgPath, JSON.stringify(message, null, 2))

  return message
}

/** Poll a recipient's inbox for unread messages */
export function pollInbox(teamId: string, recipient: string): Message[] {
  const inboxDir = join(MAILBOX_DIR, teamId, "mailbox", recipient)
  if (!existsSync(inboxDir)) return []

  const messages: Message[] = []
  for (const entry of readdirSync(inboxDir)) {
    if (entry.endsWith(".json") && !entry.startsWith(".")) {
      const content = readFileSync(join(inboxDir, entry), "utf-8")
      messages.push(JSON.parse(content))
    }
  }
  return messages
}

/** Ack a message — moves it to processed/ */
export function ackMessage(teamId: string, recipient: string, messageId: string): void {
  const inboxDir = join(MAILBOX_DIR, teamId, "mailbox", recipient)
  const processedDir = join(inboxDir, "processed")
  ensureDir(processedDir)

  const src = join(inboxDir, `${messageId}.json`)
  const dst = join(processedDir, `${messageId}.json`)

  if (existsSync(src)) {
    renameSync(src, dst)
  }
}
