import { type ReactNode, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type Task } from '../data/schema'
import { TasksMutateDrawer } from './tasks-mutate-drawer'
import { TasksProvider } from './tasks-provider'

const { apiFetchMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }

  const apiFetchMock = vi.fn(
    async (path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? 'GET'

      if (path === '/api/users/directory') return { users: [] }
      if (path === '/api/tasks' && method === 'GET') return { tasks: [] }
      if (path === '/api/tasks' && method === 'POST') {
        return {
          task: {
            description: '',
            taggedBy: 'Test User',
            taggedTo: '',
            createdAt: '',
            updatedAt: '',
            ...(options?.body as Record<string, unknown>),
          },
        }
      }
      if (path.startsWith('/api/tasks/') && method === 'PATCH') {
        const id = decodeURIComponent(path.split('/').pop() ?? '')
        return {
          task: {
            id,
            title: '',
            description: '',
            status: '',
            label: '',
            priority: '',
            taggedBy: '',
            taggedTo: '',
            createdAt: '',
            updatedAt: '',
            ...(options?.body as Record<string, unknown>),
          },
        }
      }
      return {}
    }
  )

  return { apiFetchMock, MockApiError }
})

vi.mock('@/lib/api-client', () => ({
  ApiError: MockApiError,
  apiFetch: (path: string, options?: { method?: string; body?: unknown }) =>
    apiFetchMock(path, options),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
      },
    }),
}))

const MOCK_TASK = {
  id: 'task-1',
  title: 'Existing task',
  description: 'Some detail',
  status: 'in progress',
  label: 'feature',
  priority: 'medium',
  taggedBy: 'Jane Reporter',
  taggedTo: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
} as const satisfies Task

function withProvider(children: ReactNode) {
  return <TasksProvider>{children}</TasksProvider>
}

describe('TasksMutateDrawer', () => {
  beforeEach(() => {
    apiFetchMock.mockClear()
  })

  it('renders create title and description', async () => {
    const { getByRole, getByText } = await render(
      withProvider(<TasksMutateDrawer open onOpenChange={vi.fn()} />)
    )

    const title = getByRole('heading', {
      level: 2,
      name: /Create Task/i,
    })
    const desc = getByText(/Add a new task/i)

    await expect.element(title).toBeInTheDocument()
    await expect.element(desc).toBeInTheDocument()
  })

  it('renders edit title, description, and prefilled title', async () => {
    const { getByRole, getByText } = await render(
      withProvider(
        <TasksMutateDrawer open onOpenChange={vi.fn()} currentRow={MOCK_TASK} />
      )
    )

    const title = getByRole('heading', {
      level: 2,
      name: /Update Task/i,
    })
    const desc = getByText(/Update the task/i)

    const titleInput = getByRole('textbox', { name: /^Title$/i })
    const statusSelect = getByRole('combobox', { name: /Status/i })
    const labelRadio = getByRole('radio', { name: MOCK_TASK.label })
    const priorityRadio = getByRole('radio', { name: MOCK_TASK.priority })

    await expect.element(title).toBeInTheDocument()
    await expect.element(desc).toBeInTheDocument()
    await expect.element(titleInput).toHaveValue(MOCK_TASK.title)
    await expect
      .element(statusSelect)
      .toHaveTextContent(new RegExp(MOCK_TASK.status, 'i'))
    await expect.element(labelRadio).toBeChecked()
    await expect.element(priorityRadio).toBeChecked()
  })

  it('shows validation messages when submitting an empty form', async () => {
    const { getByRole, getByText } = await render(
      withProvider(<TasksMutateDrawer open onOpenChange={vi.fn()} />)
    )

    const saveButton = getByRole('button', { name: /Save changes/i })
    await userEvent.click(saveButton)

    await expect.element(getByText(/Title is required.$/i)).toBeInTheDocument()
    await expect
      .element(getByText(/Please select a status.$/i))
      .toBeInTheDocument()
    await expect
      .element(getByText(/Please select a label.$/i))
      .toBeInTheDocument()
    await expect
      .element(getByText(/Please choose a priority.$/i))
      .toBeInTheDocument()
  })

  it('submits create form and persists the task', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      withProvider(<TasksMutateDrawer open onOpenChange={onOpenChange} />)
    )

    const titleInput = getByRole('textbox', { name: /^Title$/i })
    await userEvent.fill(titleInput, 'New task title')

    const statusSelect = getByRole('combobox', { name: /Status/i })
    await userEvent.click(statusSelect)
    await userEvent.click(getByRole('option', { name: /Todo/i }))

    await userEvent.click(getByRole('radio', { name: /^Bug$/i }))
    await userEvent.click(getByRole('radio', { name: /^Low$/i }))

    const saveButton = getByRole('button', { name: /Save changes/i })
    await userEvent.click(saveButton)

    await expect.poll(() => onOpenChange.mock.calls.length).toBeGreaterThan(0)
    expect(onOpenChange).toHaveBeenCalledWith(false)

    const createCall = apiFetchMock.mock.calls.find(
      ([path, options]) =>
        path === '/api/tasks' &&
        (options as { method?: string } | undefined)?.method === 'POST'
    )
    expect(createCall).toBeDefined()
    const body = (createCall?.[1] as { body: Record<string, unknown> }).body
    expect(body).toMatchObject({
      id: expect.stringMatching(/^TASK-\d{4}$/),
      title: 'New task title',
      status: 'todo',
      label: 'bug',
      priority: 'low',
    })
  })

  it('closes when Close is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      withProvider(<TasksMutateDrawer open onOpenChange={onOpenChange} />)
    )

    const closeButtons = getByRole('dialog')
      .getByRole('button', {
        name: /Close/i,
      })
      .all()
    expect(closeButtons).toHaveLength(2)
    await userEvent.click(closeButtons[1])

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('resets entered values when the sheet is closed and reopened', async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>
            Reopen
          </button>
          <TasksMutateDrawer open={open} onOpenChange={setOpen} />
        </>
      )
    }

    const { getByRole } = await render(withProvider(<Harness />))

    const titleInput = getByRole('textbox', { name: /^Title$/i })
    await userEvent.fill(titleInput, 'Draft title')
    await expect.element(titleInput).toHaveValue('Draft title')

    const statusSelect = getByRole('combobox', { name: /Status/i })
    await userEvent.click(statusSelect)
    await userEvent.click(getByRole('option', { name: /Todo/i }))
    await expect.element(statusSelect).toHaveTextContent(/Todo/i)

    const labelRadio = getByRole('radio', { name: /^Documentation$/i })
    await userEvent.click(labelRadio)
    await expect.element(labelRadio).toBeChecked()

    const priorityRadio = getByRole('radio', { name: /^High$/i })
    await userEvent.click(priorityRadio)
    await expect.element(priorityRadio).toBeChecked()

    const closeButtons = getByRole('dialog')
      .getByRole('button', {
        name: /Close/i,
      })
      .all()
    await userEvent.click(closeButtons[0])

    const reopenButton = getByRole('button', { name: /Reopen/i })
    await userEvent.click(reopenButton)

    await expect.element(titleInput).toHaveValue('')
    await expect.element(statusSelect).not.toHaveTextContent(/Todo/i)
    await expect.element(labelRadio).not.toBeChecked()
    await expect.element(priorityRadio).not.toBeChecked()
  })
})
