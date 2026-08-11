import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent, type Locator } from 'vitest/browser'
import { ForgotPasswordForm } from './forgot-password-form'

const navigateMock = vi.fn()
const apiFetchMock = vi.fn(() =>
  Promise.resolve({
    message: 'If an account exists, a code was sent.',
    challengeId: '65f0000000000000000000ab',
    email: 'a***@b.com',
  })
)

vi.mock('@tanstack/react-router', async (orig) => {
  const actual = await orig<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@/lib/api-client', async (orig) => ({
  ...(await orig()),
  apiFetch: apiFetchMock,
}))

describe('ForgotPasswordForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let continueButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()

    screen = await render(<ForgotPasswordForm />)
    emailInput = screen.getByRole('textbox', { name: /^Email$/i })
    continueButton = screen.getByRole('button', { name: /^Continue$/i })
  })

  it('renders email field and continue button', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(continueButton).toBeInTheDocument()
  })

  it('shows validation when submitting empty form', async () => {
    await userEvent.click(continueButton)
    await expect
      .element(screen.getByText(/^Please enter your email\.$/i))
      .toBeInTheDocument()
  })

  it('requests a code, resets the form, and opens OTP verification', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.click(continueButton)

    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/otp',
        search: {
          challenge: '65f0000000000000000000ab',
          email: 'a***@b.com',
          purpose: 'password-reset',
        },
      })
    )

    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/password/forgot', {
      method: 'POST',
      body: { email: 'a@b.com' },
    })

    // Form should reset on success
    await expect.element(emailInput).toHaveValue('')
  })
})
