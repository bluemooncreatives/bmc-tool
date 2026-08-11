import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PermissionManager } from '.'

const apiFetchMock = vi.fn()

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original()),
  apiFetch: apiFetchMock,
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))
vi.mock('@/components/header-actions', () => ({ HeaderActions: () => null }))

const longEmail =
  'a-very-long-permission-manager-address@a-very-long-example-domain.com'

describe('PermissionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: longEmail,
          firstName: 'A very long user name that must remain constrained',
          lastName: '',
          role: 'user',
          status: 'active',
          modulePermissions: [],
          isSystemOwner: false,
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
      ],
    })
  })

  it('constrains long user rows without enabling horizontal scrolling', async () => {
    const screen = await render(<PermissionManager />)
    const userRow = screen.getByRole('button', {
      name: /A very long user name that must remain constrained/i,
    })

    await expect.element(userRow).toBeInTheDocument()
    await expect.element(userRow).toHaveClass('min-w-0', 'overflow-hidden')

    const userList = userRow.element().parentElement
    expect(userList).not.toBeNull()
    expect(userList?.className).toContain('grid-cols-[minmax(0,1fr)]')
    expect(userList?.className).toContain('overflow-x-hidden')
  })

  it('keeps long selected-user details inside the responsive panel', async () => {
    const screen = await render(<PermissionManager />)
    const selectedEmail = screen.getByText(longEmail).last()

    await expect.element(selectedEmail).toHaveClass('break-all')
    await expect
      .element(screen.getByText('0 of 14 modules selected'))
      .toBeInTheDocument()
  })
})
