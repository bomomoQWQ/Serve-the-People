/**
 * 国家监委 (National Supervision Commission) timing constants.
 *
 * These govern heartbeat interval, stall detection threshold, retry
 * backoff, and escalation limits for the jianwei monitoring system.
 */

/** How often (in ms) the monitor scans for stalled workgroup tasks. */
export const STALL_CHECK_INTERVAL_MS = 60_000

/** A task is considered stalled when its updatedAt is older than this (10 min). */
export const STALL_THRESHOLD_MS = 600_000

/** Maximum number of automatic retries before escalating. */
export const MAX_RETRIES = 3

/**
 * Retry backoff delays in milliseconds.
 * Index 0 = 1st retry delay, 1 = 2nd, 2 = 3rd retry before escalation.
 */
export const RETRY_BACKOFF = [30_000, 60_000, 120_000] as const

/** Maximum number of escalation hops up the ministry hierarchy. */
export const MAX_ESCALATION = 3

/**
 * Escalation hierarchy from lowest to highest authority.
 * When retries are exhausted the task moves one step up this chain.
 */
export const ESCALATION_HIERARCHY = [
  "doing",
  "assigned",
  "menxia",
  "zhongshu",
  "taizi",
] as const
