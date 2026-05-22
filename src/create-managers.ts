/**
 * Manager creation factory.
 * Phase 1 will add BackgroundManager for async sub-agent execution.
 * For now, returns empty managers object.
 */
export interface PluginManagers {
  // Phase 1: backgroundManager: BackgroundManager
}

export function createManagers(): PluginManagers {
  return {}
}
