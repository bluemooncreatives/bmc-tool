const TERMINAL_TASK_STATUSES = new Set([
  'cancelled',
  'canceled',
  'complete',
  'completed',
  'done',
])

export const TERMINAL_TASK_STATUS_PATTERN =
  /^(?:cancelled|canceled|complete|completed|done)$/i

export function normalizeTaskStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function isTaskActive(status: string): boolean {
  return !TERMINAL_TASK_STATUSES.has(normalizeTaskStatus(status))
}
