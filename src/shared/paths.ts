/**
 * Path resolution — global vs project-level storage.
 *
 * Strategy (mirrors oh-my-openagent's ~/.omo vs <project>/.omo):
 *   - global (~/.servethepeople/): skills, archives — persist across projects
 *   - project-level (.servethepeople/): teams — ephemeral, cleanup on disband
 *
 * Project-level wins on collision (for overrides). Global is the permanent home.
 */

import { homedir } from "node:os"
import { join } from "node:path"

/** Global storage root: ~/.servethepeople/ */
export const GLOBAL_ROOT = join(homedir(), ".servethepeople")

/** Archive root (global) */
export const ARCHIVE_ROOT_GLOBAL = join(GLOBAL_ROOT, "archives")

/** Skills root (global, project-level as fallback) */
export const SKILLS_ROOT_GLOBAL = join(GLOBAL_ROOT, "skills")

/** Get the project-level storage root */
export function projectRoot(cwd: string): string {
  return join(cwd, ".servethepeople")
}

/** Get the project-level teams root */
export function projectTeamsRoot(cwd: string): string {
  return join(projectRoot(cwd), "teams")
}

/** Get the project-level archives root (fallback for reading) */
export function projectArchivesRoot(cwd: string): string {
  return join(projectRoot(cwd), "archives")
}

/** Get the project-level skills root (fallback for reading) */
export function projectSkillsRoot(cwd: string): string {
  return join(projectRoot(cwd), "skills")
}
