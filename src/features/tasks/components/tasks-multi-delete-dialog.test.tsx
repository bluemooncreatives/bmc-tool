import { useState } from 'react'
import { createTableMock } from '@/test-utils/tanstack-table'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { TasksMultiDeleteDialog } from './tasks-multi-delete-dialog'
import { TasksProvider } from './tasks-provider'

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: vi.fn(() => Promise.resolve()),
}))

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
    async (path: string, options?: { method?: string }) => {
      const method = options?.method ?? 'GET'
      if (path === '/api/tasks' && method === 'GET') return { tasks: [] }
      if (path.startsWith('/api/tasks/') && method === 'DELETE')
        return { ok: true }
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

describe('TasksMultiDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockClear()
  })

  it('renders the dialog with the correct title, description, input and buttons', async () => {
    const { table } = createTableMock()

    const { getByRole, getByText } = await render(
      <TasksProvider>
        <TasksMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
      </TasksProvider>
    )

    const title = getByRole('heading', {
      level: 2,
      name: /Delete 2 tasks/i,
    })
    const desc = getByText(
      'Are you sure you want to delete the selected tasks?'
    )
    const confirmDeleteInput = getByRole('textbox', {
      name: /Confirm by typing "DELETE"/i,
    })
    const cancelButton = getByRole('button', { name: /Cancel/i })
    const deleteButton = getByRole('button', { name: /Delete/i })

    await expect.element(title).toBeInTheDocument()
    await expect.element(desc).toBeInTheDocument()
    await expect.element(confirmDeleteInput).toBeInTheDocument()
    await expect.element(cancelButton).toBeInTheDocument()
    await expect.element(deleteButton).toBeInTheDocument()
    await expect.element(deleteButton).toBeDisabled()
  })

  it('keeps the delete button disabled until the confirm delete input is filled correctly', async () => {
    const { table } = createTableMock()
    const { getByRole } = await render(
      <TasksProvider>
        <TasksMultiDeleteDialog open onOpenChange={vi.fn()} table={table} />
      </TasksProvider>
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /Confirm by typing "DELETE"/i,
    })
    const deleteButton = getByRole('button', { name: /Delete/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'wrong-input')
    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()
  })

  it('closes the dialog when the cancel button is clicked', async () => {
    const onOpenChange = vi.fn()
    const { table } = createTableMock()
    const { getByRole } = await render(
      <TasksProvider>
        <TasksMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
      </TasksProvider>
    )

    const cancelButton = getByRole('button', { name: /Cancel/i })
    await userEvent.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('resets the confirm delete input when the dialog is closed and reopened', async () => {
    const { table } = createTableMock()

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>
            Reopen
          </button>
          {open ? (
            <TasksMultiDeleteDialog
              open={open}
              onOpenChange={setOpen}
              table={table}
            />
          ) : null}
        </>
      )
    }

    const { getByRole } = await render(
      <TasksProvider>
        <Harness />
      </TasksProvider>
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /Confirm by typing "DELETE"/i,
    })
    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(confirmDeleteInput).toHaveValue('DELETE')

    const cancelButton = getByRole('button', { name: /Cancel/i })
    await userEvent.click(cancelButton)

    const reopenButton = getByRole('button', { name: /Reopen/i })
    await userEvent.click(reopenButton)
    await expect.element(confirmDeleteInput).toHaveValue('')
  })

  it('deletes the selected tasks when confirmed', async () => {
    const { table, resetRowSelection } = createTableMock()
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <TasksProvider>
        <TasksMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
      </TasksProvider>
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /Confirm by typing "DELETE"/i,
    })
    const deleteButton = getByRole('button', { name: /Delete/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()

    await userEvent.click(deleteButton)

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await vi.waitFor(() => expect(resetRowSelection).toHaveBeenCalledOnce())
    expect(
      apiFetchMock.mock.calls.filter(
        ([path, options]) =>
          path.startsWith('/api/tasks/') &&
          (options as { method?: string } | undefined)?.method === 'DELETE'
      )
    ).toHaveLength(2)
  })

  it('deletes successfully when press Enter key on the confirm delete input', async () => {
    const { table, resetRowSelection } = createTableMock()
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <TasksProvider>
        <TasksMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
      </TasksProvider>
    )

    const confirmDeleteInput = getByRole('textbox', {
      name: /Confirm by typing "DELETE"/i,
    })
    const deleteButton = getByRole('button', { name: /Delete/i })

    await expect.element(deleteButton).toBeDisabled()

    await userEvent.fill(confirmDeleteInput, 'DELETE')
    await expect.element(deleteButton).toBeEnabled()

    await userEvent.keyboard('{Enter}')

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await vi.waitFor(() => expect(resetRowSelection).toHaveBeenCalledOnce())
  })
})
