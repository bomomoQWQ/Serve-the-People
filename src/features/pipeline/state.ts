/**
 * Pipeline state machine for the 14-step workflow.
 * Tracks the current step and transitions between them.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { projectRoot } from "../../shared/paths"

export enum PipelineState {
  IDLE = "IDLE", INTAKE = "INTAKE", QA = "QA",
  PLANNING = "PLANNING", APPROVAL = "APPROVAL",
  SPAWNING = "SPAWNING", EXECUTING = "EXECUTING",
  MONITORING = "MONITORING", AUDITING = "AUDITING",
  COMPLETE = "COMPLETE", CANCELLED = "CANCELLED",
}

export interface PipelineTask {
  taskId: string
  originalMessage: string
  state: PipelineState
  qaRounds: number
  plan?: string
  workgroupId?: string
  createdAt: string
  updatedAt: string
}

let STORAGE_DIR = ".servethepeople/pipelines"

/** Initialize pipeline storage path from workspace root. Call once during plugin init. */
export function initPipelineState(basePath: string): void {
  STORAGE_DIR = join(projectRoot(basePath), "pipelines")
}

function taskPath(taskId: string): string { return join(STORAGE_DIR, `${taskId}.json`) }

function ensureStorage(): void {
  if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true })
}

export function createPipelineTask(userMessage: string): PipelineTask {
  ensureStorage()
  const taskId = `TASK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now() % 100000).padStart(3, "0")}`
  const task: PipelineTask = {
    taskId, originalMessage: userMessage, state: PipelineState.INTAKE,
    qaRounds: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  writeFileSync(taskPath(taskId), JSON.stringify(task, null, 2))
  return task
}

export function getPipelineTask(taskId: string): PipelineTask | null {
  try {
    return JSON.parse(readFileSync(taskPath(taskId), "utf-8")) as PipelineTask
  } catch { return null }
}

export function transitionState(taskId: string, newState: PipelineState): PipelineTask | null {
  const task = getPipelineTask(taskId)
  if (!task) return null
  task.state = newState
  task.updatedAt = new Date().toISOString()
  writeFileSync(taskPath(taskId), JSON.stringify(task, null, 2))
  return task
}

export function incrementQaRound(taskId: string): number {
  const task = getPipelineTask(taskId)
  if (!task) return 0
  task.qaRounds++
  task.updatedAt = new Date().toISOString()
  writeFileSync(taskPath(taskId), JSON.stringify(task, null, 2))
  return task.qaRounds
}

export function attachWorkgroup(taskId: string, workgroupId: string): PipelineTask | null {
  const task = getPipelineTask(taskId)
  if (!task) return null
  task.workgroupId = workgroupId
  task.updatedAt = new Date().toISOString()
  writeFileSync(taskPath(taskId), JSON.stringify(task, null, 2))
  return task
}

/** Clean up pipeline state file when task is complete */
export function cleanupPipelineTask(taskId: string): void {
  const path = taskPath(taskId)
  try { if (existsSync(path)) rmSync(path) } catch { /* best effort */ }
}
