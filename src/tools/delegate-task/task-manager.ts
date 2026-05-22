/**
 * TaskManager for Serve the People plugin.
 *
 * Uses OpenCode SDK's session.create() and session.prompt() APIs
 * to spawn real sub-agent child sessions.
 */
import type { PluginInput } from "@opencode-ai/plugin"

export interface TaskInput {
  agent: string
  prompt: string
  description?: string
  parentSessionId?: string
}

export interface TaskResult {
  id: string
  sessionId: string
  agent: string
  status: "pending" | "running" | "completed" | "error"
  prompt: string
  output?: string
  error?: string
}

type SessionPromptOpts = {
  path: { id: string }
  body: { agent?: string; parts: Array<{ type: "text"; text: string }> }
}

type OpenCodeClient = PluginInput["client"] & {
  session?: {
    create?: (opts: {
      body: { parentID?: string; title: string; agent?: string }
    }) => Promise<{ data?: { id: string }; error?: unknown }>
    prompt?: (opts: SessionPromptOpts) => Promise<{ data?: unknown; error?: unknown }>
    messages?: (opts: { path: { id: string } }) => Promise<{
      data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>
      error?: unknown
    }>
  }
}

export class TaskManager {
  private client: OpenCodeClient
  private tasks = new Map<string, TaskResult>()

  constructor(client: PluginInput["client"]) {
    this.client = client as unknown as OpenCodeClient
  }

  /** Spawn a sub-agent in a real child session — waits for completion */
  async launch(input: TaskInput): Promise<TaskResult> {
    const { agent, prompt, description, parentSessionId } = input

    if (!this.client.session?.create) {
      return { id: "", sessionId: "", agent, status: "error", prompt, error: "Session create API not available" }
    }

    const createResult = await this.client.session.create({
      body: { parentID: parentSessionId, title: `${description ?? "Sub-agent task"} (@${agent})`, agent },
    })

    if (createResult.error || !createResult.data?.id) {
      return { id: "", sessionId: "", agent, status: "error", prompt, error: `Session create failed: ${String(createResult.error ?? "no ID")}` }
    }

    const sessionId = createResult.data.id

    if (this.client.session.prompt) {
      await this.client.session.prompt({
        path: { id: sessionId },
        body: { agent, parts: [{ type: "text", text: prompt }] },
      })
    }

    const task: TaskResult = { id: sessionId, sessionId, agent, status: "running", prompt }
    this.tasks.set(sessionId, task)
    return task
  }

  /** Spawn a sub-agent session — returns immediately without polling */
  async launchAsync(input: TaskInput): Promise<TaskResult> {
    const { agent, prompt, description, parentSessionId } = input

    if (!this.client.session?.create) {
      return { id: "", sessionId: "", agent, status: "error", prompt, error: "Session create API not available" }
    }

    const createResult = await this.client.session.create({
      body: { parentID: parentSessionId, title: `${description ?? "Sub-agent task"} (@${agent})`, agent },
    })

    if (createResult.error || !createResult.data?.id) {
      return { id: "", sessionId: "", agent, status: "error", prompt, error: `Session create failed: ${String(createResult.error ?? "no ID")}` }
    }

    const sessionId = createResult.data.id

    // Fire the prompt but don't wait for completion
    if (this.client.session.prompt) {
      this.client.session.prompt({
        path: { id: sessionId },
        body: { agent, parts: [{ type: "text", text: prompt }] },
      }).catch(() => {
        // Fire-and-forget — polling or idle-wake handles follow-up
      })
    }

    const task: TaskResult = { id: sessionId, sessionId, agent, status: "running", prompt }
    this.tasks.set(sessionId, task)
    return task
  }

  /** Send a follow-up prompt to an existing session (used by idle-wake) */
  async sendPrompt(sessionId: string, agent: string, text: string): Promise<void> {
    if (!this.client.session?.prompt) return
    await this.client.session.prompt({
      path: { id: sessionId },
      body: { agent, parts: [{ type: "text", text }] },
    })
  }

  /** Poll a session for completion */
  async poll(sessionId: string, maxPolls = 200): Promise<TaskResult> {
    const task = this.tasks.get(sessionId)
    if (!task) return { id: sessionId, sessionId, agent: "unknown", status: "error", prompt: "", error: "Task not found" }
    if (task.status !== "running") return task

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      if (!this.client.session?.messages) continue

      const msgResult = await this.client.session.messages({ path: { id: sessionId } })
      const msgs = msgResult.data
      if (!msgs || msgs.length === 0) continue

      // 倒查最后一条 assistant 消息（跳过 tool/system 尾随消息）
      for (let j = msgs.length - 1; j >= 0; j--) {
        const msg = msgs[j]
        if (msg.info?.role === "assistant") {
          const output = (msg.parts ?? [])
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("\n")
          task.status = "completed"
          task.output = output || "(no text output)"
          return task
        }
      }
    }

    task.status = "error"
    task.error = "Polling timed out"
    return task
  }

  getTask(sessionId: string): TaskResult | undefined { return this.tasks.get(sessionId) }
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status === "completed") return false
    task.status = "error"
    task.error = "Cancelled"
    return true
  }
  cancelAll(): number {
    let count = 0
    for (const task of this.tasks.values()) {
      if (task.status === "pending" || task.status === "running") {
        task.status = "error"
        task.error = "Cancelled"
        count++
      }
    }
    return count
  }
}
