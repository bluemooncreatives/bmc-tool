import { type ColorKey, COLOR_PALETTE } from './color-palette'
import { ICONS, type IconKey } from './icons'

export type TaskOption = {
  value: string
  label: string
  icon: IconKey
  colorKey: ColorKey
}

// A store-ready option resolved into render-ready values (icon component +
// tailwind classes) for consumption by table cells, filters, and forms.
export type ResolvedTaskOption = {
  value: string
  label: string
  icon: (typeof ICONS)[IconKey]
  color: string
  badgeClassName: string
}

export function resolveOption(option: TaskOption): ResolvedTaskOption {
  const palette = COLOR_PALETTE[option.colorKey]
  return {
    value: option.value,
    label: option.label,
    icon: ICONS[option.icon],
    color: palette.text,
    badgeClassName: palette.badge,
  }
}

export function resolveOptions(options: TaskOption[]): ResolvedTaskOption[] {
  return options.map(resolveOption)
}

export const defaultLabels: TaskOption[] = [
  { value: 'bug', label: 'Bug', icon: 'bug', colorKey: 'red' },
  { value: 'feature', label: 'Feature', icon: 'sparkles', colorKey: 'violet' },
  {
    value: 'documentation',
    label: 'Documentation',
    icon: 'bookmark',
    colorKey: 'blue',
  },
]

export const defaultStatuses: TaskOption[] = [
  { value: 'backlog', label: 'Backlog', icon: 'help-circle', colorKey: 'slate' },
  { value: 'todo', label: 'Todo', icon: 'circle', colorKey: 'sky' },
  {
    value: 'in progress',
    label: 'In Progress',
    icon: 'timer',
    colorKey: 'amber',
  },
  { value: 'done', label: 'Done', icon: 'check-circle', colorKey: 'emerald' },
  { value: 'canceled', label: 'Canceled', icon: 'circle-off', colorKey: 'rose' },
]

export const defaultPriorities: TaskOption[] = [
  { value: 'low', label: 'Low', icon: 'arrow-down', colorKey: 'sky' },
  { value: 'medium', label: 'Medium', icon: 'arrow-right', colorKey: 'amber' },
  { value: 'high', label: 'High', icon: 'arrow-up', colorKey: 'orange' },
  {
    value: 'critical',
    label: 'Critical',
    icon: 'alert-circle',
    colorKey: 'red',
  },
]
