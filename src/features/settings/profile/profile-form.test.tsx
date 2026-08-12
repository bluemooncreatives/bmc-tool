import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useAuthStore } from '@/stores/auth-store'
import { ProfileForm } from './profile-form'
import { type AccountProfile } from './profile-types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchMock = vi.fn()

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const profile: AccountProfile = {
  name: 'BMC Member',
  username: 'bmc-member',
  canonicalEmail: 'member@example.com',
  displayEmail: 'member@example.com',
  bio: '',
  dateOfBirth: '1995-06-15',
  language: 'en',
  urls: ['https://example.com/'],
  emails: [
    {
      address: 'member@example.com',
      isPrimary: true,
      verified: true,
    },
  ],
  usernameAvailableAt: null,
  updatedAt: '2026-08-12T10:00:00.000Z',
}

const publicUser = {
  id: '65f0000000000000000000aa',
  accountNo: 'ACC-1',
  email: 'member@example.com',
  username: 'bmc-member',
  displayEmail: 'member@example.com',
  name: 'BMC Member',
  role: ['user'],
}

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().auth.reset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(
      async (path: string, options?: RequestInit) => {
        if (path === '/api/account/profile' && options?.method === 'GET') {
          return jsonResponse({ profile })
        }
        if (path === '/api/account/profile' && options?.method === 'PATCH') {
          const body = JSON.parse(String(options.body)) as {
            bio: string
            urls: string[]
          }
          return jsonResponse({
            profile: {
              ...profile,
              bio: body.bio,
              urls: body.urls,
              updatedAt: '2026-08-12T10:01:00.000Z',
            },
            user: publicUser,
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads the persisted profile and starts with saving disabled', async () => {
    const screen = await render(<ProfileForm />)

    await expect
      .element(screen.getByLabelText(/^Username$/i))
      .toHaveValue('bmc-member')
    await expect
      .element(screen.getByLabelText(/^Name$/i))
      .toHaveValue('BMC Member')
    await expect
      .element(screen.getByRole('button', { name: 'Date of birth' }))
      .toHaveTextContent('Jun 15, 1995')
    await expect
      .element(screen.getByLabelText(/^Language$/i))
      .toHaveTextContent('English')
    await expect.element(screen.getByLabelText(/Bio/i)).toHaveValue('')
    await expect
      .element(screen.getByRole('button', { name: 'Update profile & account' }))
      .toBeDisabled()
    expect(fetchMock).toHaveBeenCalled()

    const username = await screen.getByLabelText(/^Username$/i).element()
    const dateOfBirth = await screen
      .getByRole('button', { name: 'Date of birth' })
      .element()
    expect(username.closest('section')?.className).toContain('md:grid-cols-2')
    expect(dateOfBirth.closest('section')?.className).toContain(
      'md:grid-cols-2'
    )
  })

  it('submits optional fields and synchronizes the authenticated user', async () => {
    const screen = await render(<ProfileForm />)
    const bio = screen.getByLabelText(/Bio/i)
    await expect.element(bio).toBeInTheDocument()

    await userEvent.fill(bio, 'Product designer and illustrator.')
    await userEvent.click(
      screen.getByRole('button', { name: 'Update profile & account' })
    )

    await vi.waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([path, options]) =>
          path === '/api/account/profile' && options?.method === 'PATCH'
      )
      expect(patchCall).toBeDefined()
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        username: 'bmc-member',
        name: 'BMC Member',
        displayEmail: 'member@example.com',
        dateOfBirth: '1995-06-15',
        language: 'en',
        bio: 'Product designer and illustrator.',
        urls: ['https://example.com/'],
        expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      })
    })
    expect(useAuthStore.getState().auth.user).toEqual(publicUser)
  })

  it('adds and removes optional URL controls', async () => {
    const screen = await render(<ProfileForm />)
    await expect
      .element(screen.getByRole('textbox', { name: 'URL 1', exact: true }))
      .toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add URL' }))
    await expect
      .element(screen.getByRole('textbox', { name: 'URL 2', exact: true }))
      .toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove URL 2' }))
    await expect
      .element(screen.getByRole('textbox', { name: 'URL 2', exact: true }))
      .not.toBeInTheDocument()
  })

  it('blocks duplicate canonical URLs before sending an update', async () => {
    const screen = await render(<ProfileForm />)
    await expect
      .element(screen.getByRole('textbox', { name: 'URL 1', exact: true }))
      .toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add URL' }))
    await userEvent.fill(
      screen.getByRole('textbox', { name: 'URL 2', exact: true }),
      'https://example.com'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Update profile & account' })
    )

    await expect
      .element(screen.getByText('Duplicate URLs are not allowed.'))
      .toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(
        ([path, options]) =>
          path === '/api/account/profile' && options?.method === 'PATCH'
      )
    ).toHaveLength(0)
  })
})
