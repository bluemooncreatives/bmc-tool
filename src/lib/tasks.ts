/**
 * Statuses that close a task, as normalized keys. This is the single source of
 * truth: the database stores `statusKey` in exactly this form, so a query can
 * match on equality against an index instead of testing a regular expression
 * against free-form display text.
 */
export const TERMINAL_TASK_STATUS_KEYS = [
  'cancelled',
  'canceled',
  'complete',
  'completed',
  'done',
] as const

const TERMINAL_TASK_STATUSES = new Set<string>(TERMINAL_TASK_STATUS_KEYS)

/**
 * Collapses the casing, separators, and padding a status may be entered with
 * so that `In_Progress`, `in progress`, and ` In  Progress ` are one value.
 */
export function normalizeTaskStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function isTaskActive(status: string): boolean {
  return !TERMINAL_TASK_STATUSES.has(normalizeTaskStatus(status))
}
