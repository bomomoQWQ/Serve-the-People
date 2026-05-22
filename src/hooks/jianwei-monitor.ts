import type { Event } from "@opencode-ai/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { ServeThePeopleConfig } from "../config"
import {
  STALL_CHECK_INTERVAL_MS,
  STALL_THRESHOLD_MS,
  MAX_RETRIES,
  RETRY_BACKOFF,
  MAX_ESCALATION,
  ESCALATION_HIERARCHY,
} from "./constants"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed"

export interface MonitoredTask {
  taskId: string
  sessionID: string
  agent: string
  status: TaskStatus
  updatedAt: number
  createdAt: number
  retryCount: number
  escalationCount: number
}

export interface JianweiReport {
  timestamp: string
  monitor: string
  taskCount: number
  stalled: number
  retried: number
  escalated: number
  failed: number
  tasks: Array<{
    taskId: string
    sessionID: string
    agent: string
    status: TaskStatus
    retryCount: number
    escalationCount: number
    age: number
    idle: number
  }>
}

// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------

export class JianweiMonitor {
  private client: OpencodeClient
  private config: ServeThePeopleConfig
  private tasks: Map<string, MonitoredTask> = new Map()
  private timer: ReturnType<typeof setInterval> | null = null
  private disposed = false
  private reportTimer: ReturnType<typeof setInterval> | null = null
  private mailboxDir: string

  constructor(
    client: OpencodeClient,
    config: ServeThePeopleConfig,
    worktree: string,
  ) {
    this.client = client
    this.config = config
    this.mailboxDir = `${worktree}/.servethepeople/teams/monitoring/mailbox/guowuyuan`
    this.start()
  }

  // -- public API -----------------------------------------------------------

  /** Register a task for heartbeat monitoring. */
  registerTask(input: {
    taskId: string
    sessionID: string
    agent: string
    status?: TaskStatus
  }): void {
    const now = Date.now()
    this.tasks.set(input.taskId, {
      taskId: input.taskId,
      sessionID: input.sessionID,
      agent: input.agent,
      status: input.status ?? "pending",
      retryCount: 0,
      escalationCount: 0,
      updatedAt: now,
      createdAt: now,
    })
    this.debug(`registered task ${input.taskId} (agent: ${input.agent})`)
  }

  /** Update a monitored task's status / agent. Resets updatedAt. */
  updateTask(
    taskId: string,
    update: Partial<Pick<MonitoredTask, "status" | "agent">>,
  ): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    Object.assign(task, update, { updatedAt: Date.now() })
  }

  /** Mark a task as completed. */
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status = "completed"
    task.updatedAt = Date.now()
  }

  /**
   * Process an OpenCode lifecycle event.
   * Called from the plugin's `event` hook wrapper.
   */
  onEvent(event: Event): void {
    if (this.disposed) return

    switch (event.type) {
      case "server.instance.disposed":
        this.dispose()
        break
      case "session.idle":
        // Session went idle — any in_progress tasks on this session
        // are now potentially stalled.  The next periodic scan will
        // catch them if they exceed STALL_THRESHOLD_MS.
        break
    }
  }

  /** Stop all intervals and release resources. */
  dispose(): void {
    this.disposed = true
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.reportTimer !== null) {
      clearInterval(this.reportTimer)
      this.reportTimer = null
    }
    this.debug("monitor disposed")
  }

  // -- internal -------------------------------------------------------------

  private start(): void {
    // Scan for stalled tasks every STALL_CHECK_INTERVAL_MS
    this.timer = setInterval(() => {
      this.checkStalls().catch((err) => {
        this.debug(`stall check error: ${String(err)}`)
      })
    }, STALL_CHECK_INTERVAL_MS)

    // Generate periodic memorial reports (every 5 minutes)
    this.reportTimer = setInterval(() => {
      this.generateReport().catch((err) => {
        this.debug(`report error: ${String(err)}`)
      })
    }, 300_000)
  }

  private async checkStalls(): Promise<void> {
    if (this.disposed) return

    const now = Date.now()
    const stalled: MonitoredTask[] = []

    for (const task of this.tasks.values()) {
      if (task.status !== "in_progress") continue
      if (now - task.updatedAt < STALL_THRESHOLD_MS) continue
      stalled.push(task)
    }

    if (stalled.length === 0) return

    this.debug(`detected ${stalled.length} stalled task(s)`)

    // Handle all stalled tasks concurrently
    const results = await Promise.allSettled(
      stalled.map((t) => this.handleStalledTask(t, now)),
    )

    for (const result of results) {
      if (result.status === "rejected") {
        this.debug(`handler error: ${String(result.reason)}`)
      }
    }
  }

  private async handleStalledTask(
    task: MonitoredTask,
    now: number,
  ): Promise<void> {
    if (task.retryCount < MAX_RETRIES) {
      await this.retryTask(task)
    } else if (task.escalationCount < MAX_ESCALATION) {
      await this.escalateTask(task)
    } else {
      this.debug(
        `task ${task.taskId}: max retries (${MAX_RETRIES}) and escalations ` +
          `(${MAX_ESCALATION}) exhausted — marking failed`,
      )
      task.status = "failed"
      task.updatedAt = now
    }
  }

  private async retryTask(task: MonitoredTask): Promise<void> {
    const idx = Math.min(task.retryCount, RETRY_BACKOFF.length - 1)
    const delay = RETRY_BACKOFF[idx]!

    this.debug(
      `task ${task.taskId}: retry ${task.retryCount + 1}/${MAX_RETRIES} ` +
        `after ${delay}ms`,
    )

    await sleep(delay)
    if (this.disposed) return

    task.retryCount++
    task.updatedAt = Date.now()

    try {
      await this.client.session.prompt({
        path: { id: task.sessionID },
        body: {
          agent: task.agent,
          parts: [
            {
              type: "text",
              text:
                `[国家监委] 任务 ${task.taskId} 疑似停滞，` +
                `第 ${task.retryCount}/${MAX_RETRIES} 次自动重试。请继续执行。`,
            },
          ],
        },
      })
      this.debug(`task ${task.taskId}: retry dispatched`)
    } catch (err) {
      this.debug(`task ${task.taskId}: retry dispatch failed — ${String(err)}`)
    }
  }

  private async escalateTask(task: MonitoredTask): Promise<void> {
    const currentIdx = ESCALATION_HIERARCHY.indexOf(
      task.agent as (typeof ESCALATION_HIERARCHY)[number],
    )

    if (currentIdx < 0 || currentIdx >= ESCALATION_HIERARCHY.length - 1) {
      this.debug(
        `task ${task.taskId}: agent "${task.agent}" is at or beyond ` +
          `top of hierarchy — marking failed`,
      )
      task.status = "failed"
      task.updatedAt = Date.now()
      return
    }

    const escalatedAgent = ESCALATION_HIERARCHY[currentIdx + 1]!
    this.debug(
      `task ${task.taskId}: escalating ${task.agent} → ${escalatedAgent}` +
        ` (escalation ${task.escalationCount + 1}/${MAX_ESCALATION})`,
    )

    task.escalationCount++
    task.agent = escalatedAgent
    task.updatedAt = Date.now()

    try {
      await this.client.session.prompt({
        path: { id: task.sessionID },
        body: {
          agent: escalatedAgent,
          parts: [
            {
              type: "text",
              text:
                `[国家监委] 任务 ${task.taskId} 经 ${MAX_RETRIES} 次重试仍停滞，` +
                `已升级至 ${escalatedAgent} 处理（第 ${task.escalationCount}/${MAX_ESCALATION} 次升级）。` +
                `请接管此任务。`,
            },
          ],
        },
      })
      this.debug(`task ${task.taskId}: escalated to ${escalatedAgent}`)
    } catch (err) {
      this.debug(
        `task ${task.taskId}: escalation dispatch failed — ${String(err)}`,
      )
    }
  }

  private async generateReport(): Promise<void> {
    const now = Date.now()
    const taskArray = Array.from(this.tasks.values())

    const report: JianweiReport = {
      timestamp: new Date().toISOString(),
      monitor: "国家监委",
      taskCount: taskArray.length,
      stalled: 0,
      retried: 0,
      escalated: 0,
      failed: 0,
      tasks: taskArray.map((t) => ({
        taskId: t.taskId,
        sessionID: t.sessionID,
        agent: t.agent,
        status: t.status,
        retryCount: t.retryCount,
        escalationCount: t.escalationCount,
        age: now - t.createdAt,
        idle: t.status === "in_progress" ? now - t.updatedAt : 0,
      })),
    }

    report.stalled = report.tasks.filter(
      (t) => t.status === "in_progress" && t.idle > STALL_THRESHOLD_MS,
    ).length
    report.retried = report.tasks.filter((t) => t.retryCount > 0).length
    report.escalated = report.tasks.filter(
      (t) => t.escalationCount > 0,
    ).length
    report.failed = report.tasks.filter((t) => t.status === "failed").length

    await writeReport(this.mailboxDir, report)
    this.debug(`memorial report written (${report.taskCount} tasks)`)
  }

  private debug(msg: string): void {
    if (this.config.debug) {
      console.log(`[国家监委] ${msg}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function writeReport(
  dir: string,
  report: JianweiReport,
): Promise<void> {
  // Use dynamic import so the module compiles in both Bun & Node.
  const { mkdir, writeFile } = await import("node:fs/promises")
  await mkdir(dir, { recursive: true })
  const filename = `jianwei-${Date.now()}.json`
  await writeFile(`${dir}/${filename}`, JSON.stringify(report, null, 2), "utf-8")
}
