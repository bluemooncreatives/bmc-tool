import React, { useCallback, useEffect, useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'
import { type Task } from '../data/schema'

type TasksDialogType =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'manage-options'

export type TaskInput = {
  id: string
  title: string
  description?: string
  status: string
  label: string
  priority: string
  taggedTo?: string
}

type TasksContextType = {
  open: TasksDialogType | null
  setOpen: (str: TasksDialogType | null) => void
  currentRow: Task | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Task | null>>
  tasks: Task[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTask: (input: TaskInput) => Promise<Task>
  updateTask: (id: string, input: Partial<TaskInput>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  deleteTasks: (ids: string[]) => Promise<void>
}

const TasksContext = React.createContext<TasksContextType | null>(null)

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<TasksDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Task | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiFetch<{ tasks: Task[] }>('/api/tasks')
      setTasks(response.tasks)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tasks.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createTask = useCallback(async (input: TaskInput) => {
    const response = await apiFetch<{ task: Task }>('/api/tasks', {
      method: 'POST',
      body: input,
    })
    setTasks((prev) => [response.task, ...prev])
    return response.task
  }, [])

  const updateTask = useCallback(async (id: string, input: Partial<TaskInput>) => {
    const response = await apiFetch<{ task: Task }>(
      `/api/tasks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: input }
    )
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? response.task : task))
    )
    return response.task
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }, [])

  const deleteTasks = useCallback(async (ids: string[]) => {
    await Promise.all(
      ids.map((id) =>
        apiFetch(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
      )
    )
    setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
  }, [])

  return (
    <TasksContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        tasks,
        isLoading,
        error,
        refetch,
        createTask,
        updateTask,
        deleteTask,
        deleteTasks,
      }}
    >
      {children}
    </TasksContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTasks = () => {
  const tasksContext = React.useContext(TasksContext)

  if (!tasksContext) {
    throw new Error('useTasks has to be used within <TasksContext>')
  }

  return tasksContext
}
