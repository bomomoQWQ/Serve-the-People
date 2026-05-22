/**
 * 工作组 spawn/status management.
 * Tracks workgroup runtime state.
 * Layout: .servethepeople/teams/{teamId}/state.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"

export type WorkgroupStatus = "creating" | "active" | "completed" | "failed"

export interface WorkgroupState {
  teamId: string
  name: string
  status: WorkgroupStatus
  members: string[]
  plan: string
  createdAt: string
  updatedAt: string
}

const STATE_DIR = ".servethepeople/teams"

/** Create a new workgroup */
export function createWorkgroup(teamId: string, name: string, members: string[], plan: string): WorkgroupState {
  const dir = join(STATE_DIR, teamId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const now = new Date().toISOString()
  const state: WorkgroupState = {
    teamId, name, plan, members,
    status: "active", createdAt: now, updatedAt: now,
  }

  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2))
  return state
}

/** Get workgroup state */
export function getWorkgroup(teamId: string): WorkgroupState | null {
  const file = join(STATE_DIR, teamId, "state.json")
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, "utf-8")) as WorkgroupState
}

/** Update workgroup status */
export function updateWorkgroupStatus(teamId: string, status: WorkgroupStatus): WorkgroupState | null {
  const state = getWorkgroup(teamId)
  if (!state) return null

  state.status = status
  state.updatedAt = new Date().toISOString()
  writeFileSync(join(STATE_DIR, teamId, "state.json"), JSON.stringify(state, null, 2))
  return state
}

/** Clean up workgroup directory (state + tasks + mailbox + audit).
 *  Called when workgroup is disbanded after learning loop completes.
 *  Archives and skills are in global ~/.servethepeople/ — untouched. */
export function cleanupWorkgroup(teamId: string): boolean {
  const dir = join(STATE_DIR, teamId)
  if (!existsSync(dir)) return false
  try {
    rmSync(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}
