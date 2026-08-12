import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useAuthStore } from '@/stores/auth-store'
import { DisplayForm } from './display-form'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchMock = vi.fn()
const preferences = {
  availableItems: [
    {
      id: 'home',
      label: 'Home',
      description: 'Operational overview and dashboard.',
      group: 'Operations',
      required: false,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Task lists, ownership, and delivery status.',
      group: 'Operations',
      required: false,
    },
    {
      id: 'settings_display',
      label: 'Display settings',
      description: 'Application display preferences.',
      group: 'Settings',
      required: true,
    },
  ],
  selectedItems: ['home', 'tasks', 'settings_display'],
  updatedAt: '2026-08-12T10:00:00.000Z',
}
const user = {
  id: '65f0000000000000000000aa',
  accountNo: 'ACC-1',
  email: 'member@example.com',
  username: 'member',
  displayEmail: 'member@example.com',
  role: ['user'],
  modulePermissions: ['home', 'tasks', 'settings_display'],
  hiddenSidebarItems: ['tasks'],
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('DisplayForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().auth.reset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/api/account/display' && options?.method === 'GET') {
          return response({ preferences })
        }
        if (path === '/api/account/display' && options?.method === 'PATCH') {
          return response({
            preferences: {
              ...preferences,
              selectedItems: ['home', 'settings_display'],
              updatedAt: '2026-08-12T10:01:00.000Z',
            },
            user,
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads only server-provided navigation options and protects Display', async () => {
    const screen = await render(<DisplayForm />)

    await expect.element(screen.getByLabelText('Home')).toBeChecked()
    await expect.element(screen.getByLabelText('Tasks')).toBeChecked()
    await expect
      .element(screen.getByLabelText('Display settings'))
      .toBeDisabled()
    await expect
      .element(screen.getByText('Applications'))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Update display' }))
      .toBeDisabled()
  })

  it('persists visibility choices and updates the active user immediately', async () => {
    const screen = await render(<DisplayForm />)
    const tasks = screen.getByLabelText('Tasks')
    await expect.element(tasks).toBeChecked()

    await userEvent.click(tasks)
    await userEvent.click(
      screen.getByRole('button', { name: 'Update display' })
    )

    await vi.waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(
        ([path, options]) =>
          path === '/api/account/display' && options?.method === 'PATCH'
      )
      expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({
        selectedItems: ['home', 'settings_display'],
        expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      })
    })
    expect(useAuthStore.getState().auth.user).toEqual(user)
  })

  it('discards unsaved visibility changes', async () => {
    const screen = await render(<DisplayForm />)
    const tasks = screen.getByLabelText('Tasks')
    await expect.element(tasks).toBeChecked()

    await userEvent.click(tasks)
    await expect.element(tasks).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await expect.element(tasks).toBeChecked()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
