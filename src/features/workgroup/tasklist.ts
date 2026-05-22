/**
 * 工作组 tasklist — JSON per task + atomic claiming + blockedBy dependencies.
 * Layout: .servethepeople/teams/{teamId}/tasks/{taskId}.json
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type TaskStatus = "pending" | "claimed" | "in_progress" | "completed"

export interface Task {
  id: string
  subject: string
  description?: string
  status: TaskStatus
  owner?: string
  blockedBy: string[]
  createdAt: string
  updatedAt: string
}

const TASKS_DIR = ".servethepeople/teams"

function tasksDir(teamId: string): string {
  const dir = join(TASKS_DIR, teamId, "tasks")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Create a new task */
export function createTask(teamId: string, subject: string, blockedBy: string[] = [], description?: string): Task {
  const dir = tasksDir(teamId)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()

  const task: Task = {
    id, subject, description, blockedBy, owner: undefined,
    status: "pending", createdAt: now, updatedAt: now,
  }

  writeFileSync(join(dir, `${id}.json`), JSON.stringify(task, null, 2))
  return task
}

/** List tasks for a team, optionally filtered by status/owner */
export function listTasks(teamId: string, filter?: { status?: TaskStatus; owner?: string }): Task[] {
  const dir = tasksDir(teamId)
  if (!existsSync(dir)) return []

  const tasks: Task[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".json")) {
      const task = JSON.parse(readFileSync(join(dir, entry), "utf-8")) as Task
      if (filter?.status && task.status !== filter.status) continue
      if (filter?.owner && task.owner !== filter.owner) continue
      tasks.push(task)
    }
  }
  return tasks.sort((a, b) => a.id.localeCompare(b.id))
}

/** Get a single task */
export function getTask(teamId: string, taskId: string): Task | null {
  const dir = tasksDir(teamId)
  const file = join(dir, `${taskId}.json`)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, "utf-8")) as Task
}

/** Claim a task — only if all blockedBy tasks are completed */
export function claimTask(teamId: string, taskId: string, owner: string): Task | null {
  const dir = tasksDir(teamId)
  const file = join(dir, `${taskId}.json`)
  if (!existsSync(file)) return null

  const task = JSON.parse(readFileSync(file, "utf-8")) as Task
  if (task.status !== "pending") return null

  // Check blockers
  for (const blockerId of task.blockedBy) {
    const blocker = getTask(teamId, blockerId)
    if (!blocker || blocker.status !== "completed") return null
  }

  task.status = "claimed"
  task.owner = owner
  task.updatedAt = new Date().toISOString()
  writeFileSync(file, JSON.stringify(task, null, 2))
  return task
}

/** Update task status */
export function updateTask(teamId: string, taskId: string, status: TaskStatus): Task | null {
  const dir = tasksDir(teamId)
  const file = join(dir, `${taskId}.json`)
  if (!existsSync(file)) return null

  const task = JSON.parse(readFileSync(file, "utf-8")) as Task
  task.status = status
  task.updatedAt = new Date().toISOString()
  writeFileSync(file, JSON.stringify(task, null, 2))
  return task
}
