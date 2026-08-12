import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { EmailManager } from './email-manager'
import { type AccountProfile } from './profile-types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const profile: AccountProfile = {
  username: 'member',
  canonicalEmail: 'member@example.com',
  displayEmail: 'member@example.com',
  bio: '',
  urls: [],
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

describe('EmailManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('requests and verifies a secondary email address', async () => {
    const updated = {
      ...profile,
      emails: [
        ...profile.emails,
        {
          address: 'second@example.com',
          isPrimary: false,
          verified: true,
        },
      ],
      updatedAt: '2026-08-12T10:02:00.000Z',
    }
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            challengeId: 'challenge-1',
            email: 'se****@example.com',
            expiresIn: 600,
            resendAfter: 60,
          },
          202
        )
      )
      .mockResolvedValueOnce(jsonResponse({ profile: updated }))
    const onProfileChange = vi.fn()
    const screen = await render(
      <EmailManager profile={profile} onProfileChange={onProfileChange} />
    )

    await userEvent.fill(
      screen.getByLabelText('New email address'),
      'second@example.com'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add email' }))
    await expect
      .element(screen.getByLabelText('Email verification code'))
      .toBeInTheDocument()

    await userEvent.fill(
      screen.getByLabelText('Email verification code'),
      '123456'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))

    await vi.waitFor(() =>
      expect(onProfileChange).toHaveBeenCalledWith(updated)
    )
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/account/emails')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'second@example.com',
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/account/emails/verify')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      challengeId: 'challenge-1',
      code: '123456',
    })
  })
})
