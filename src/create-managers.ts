/**
 * Manager creation factory.
 * Currently no managers required — workgroup/mailbox/tasklist are file-based.
 */
export interface PluginManagers {}

export function createManagers(): PluginManagers {
  return {}
}
