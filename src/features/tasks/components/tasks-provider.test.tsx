import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { TasksProvider, useTasks } from './tasks-provider'

const apiFetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original()),
  apiFetch: apiFetchMock,
}))

const activeTask = {
  id: 'TASK-1',
  title: 'Active work',
  description: '',
  status: 'in progress',
  label: 'feature',
  priority: 'medium',
  taggedBy: 'Owner',
  taggedTo: '',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
}

const completedTask = {
  ...activeTask,
  id: 'TASK-2',
  title: 'Completed work',
  status: 'done',
}

function Harness() {
  const { tasks, isLoading, error, updateTask } = useTasks()
  return (
    <div>
      <span>{isLoading ? 'Loading' : 'Loaded'}</span>
      {error && <span>{error}</span>}
      {tasks.map((task) => (
        <span key={task.id}>{task.title}</span>
      ))}
      <button
        type='button'
        onClick={() => void updateTask(activeTask.id, { status: 'done' })}
      >
        Complete active task
      </button>
    </div>
  )
}

describe('TasksProvider active scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockImplementation(
      async (path: string, options?: { method?: string }) => {
        if (path === '/api/tasks?scope=active') {
          return { tasks: [activeTask, completedTask] }
        }
        if (path === '/api/tasks/TASK-1' && options?.method === 'PATCH') {
          return { task: completedTask }
        }
        throw new Error(`Unexpected request: ${path}`)
      }
    )
  })

  it('requests the secured active scope and excludes terminal tasks defensively', async () => {
    const screen = await render(
      <TasksProvider scope='active'>
        <Harness />
      </TasksProvider>
    )

    await expect.element(screen.getByText('Loaded')).toBeInTheDocument()
    await expect.element(screen.getByText('Active work')).toBeInTheDocument()
    await expect
      .element(screen.getByText('Completed work'))
      .not.toBeInTheDocument()
    expect(apiFetchMock).toHaveBeenCalledWith('/api/tasks?scope=active')
  })

  it('removes a task immediately when it becomes terminal', async () => {
    const screen = await render(
      <TasksProvider scope='active'>
        <Harness />
      </TasksProvider>
    )
    await expect.element(screen.getByText('Active work')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Complete active task'))
    await expect
      .element(screen.getByText('Active work'))
      .not.toBeInTheDocument()
  })
})
