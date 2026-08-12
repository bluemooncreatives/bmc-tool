import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ColorKey } from '../data/color-palette'
import {
  defaultLabels,
  defaultPriorities,
  defaultStatuses,
  type TaskOption,
} from '../data/data'
import { type IconKey } from '../data/icons'

export type TaskOptionKind = 'label' | 'status' | 'priority'

type NewOptionInput = {
  label: string
  icon: IconKey
  colorKey: ColorKey
}

function slugify(label: string, existingValues: string[]) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim() || 'option'

  let candidate = base
  let suffix = 2
  while (existingValues.includes(candidate)) {
    candidate = `${base} ${suffix}`
    suffix += 1
  }
  return candidate
}

function listKey(kind: TaskOptionKind): 'labels' | 'statuses' | 'priorities' {
  return kind === 'label'
    ? 'labels'
    : kind === 'status'
      ? 'statuses'
      : 'priorities'
}

type TaskOptionsState = {
  labels: TaskOption[]
  statuses: TaskOption[]
  priorities: TaskOption[]
  addOption: (kind: TaskOptionKind, input: NewOptionInput) => TaskOption
  updateOption: (
    kind: TaskOptionKind,
    value: string,
    patch: Partial<NewOptionInput>
  ) => void
  removeOption: (kind: TaskOptionKind, value: string) => boolean
}

export const useTaskOptionsStore = create<TaskOptionsState>()(
  persist(
    (set, get) => ({
      labels: defaultLabels,
      statuses: defaultStatuses,
      priorities: defaultPriorities,

      addOption: (kind, input) => {
        const key = listKey(kind)
        const current = get()[key]
        const value = slugify(
          input.label,
          current.map((option) => option.value)
        )
        const newOption: TaskOption = {
          value,
          label: input.label.trim(),
          icon: input.icon,
          colorKey: input.colorKey,
        }
        set({ [key]: [...current, newOption] } as Pick<
          TaskOptionsState,
          typeof key
        >)
        return newOption
      },

      updateOption: (kind, value, patch) => {
        const key = listKey(kind)
        const current = get()[key]
        set({
          [key]: current.map((option) =>
            option.value === value
              ? {
                  ...option,
                  ...patch,
                  label: patch.label?.trim() ?? option.label,
                }
              : option
          ),
        } as Pick<TaskOptionsState, typeof key>)
      },

      removeOption: (kind, value) => {
        const key = listKey(kind)
        const current = get()[key]
        if (current.length <= 1) return false
        set({
          [key]: current.filter((option) => option.value !== value),
        } as Pick<TaskOptionsState, typeof key>)
        return true
      },
    }),
    { name: 'task-options-storage' }
  )
)
