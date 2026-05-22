/**
 * Minimal ripgrep CLI resolution.
 * Uses the system-installed `rg` command.
 * For production, this could auto-download ripgrep like oh-my-openagent does.
 */
import { which } from "bun"

let _rgPath: string | null = null

export async function resolveRgCli(): Promise<string> {
  if (_rgPath) return _rgPath
  try {
    _rgPath = await which("rg") as string
    return _rgPath!
  } catch {
    // Fallback: try common paths
    return "rg"
  }
}

/** Run rg with given args and return stdout */
export async function runRg(args: string[], cwd?: string): Promise<string> {
  const rg = await resolveRgCli()
  const proc = Bun.spawn([rg, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()

  // rg exits 1 when no matches — not an error
  if (exitCode !== 0 && exitCode !== 1) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`rg exited with ${exitCode}: ${stderr}`)
  }

  return stdout.trim()
}
