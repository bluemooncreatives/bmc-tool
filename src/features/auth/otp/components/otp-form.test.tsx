import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { OtpForm } from './otp-form'

const navigate = vi.fn()
const setUser = vi.fn()
const apiFetch = vi.fn(() =>
  Promise.resolve({
    purpose: 'sign-in' as const,
    user: {
      id: '65f0000000000000000000aa',
      accountNo: 'ACC-1',
      email: 'a@b.com',
      role: ['superadmin'],
    },
  })
)

vi.mock('@tanstack/react-router', async (orig) => {
  const actual = await orig<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@/lib/api-client', async (orig) => ({ ...(await orig()), apiFetch }))
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { setUser } }),
}))

describe('OtpForm', () => {
  let screen: RenderResult
  let otpInput: Locator
  let verifyButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()

    screen = await render(
      <OtpForm challengeId='65f0000000000000000000ab' purpose='sign-in' />
    )
    otpInput = screen.getByLabelText(/^One-Time Password$/i)
    verifyButton = screen.getByRole('button', { name: /^Verify code$/i })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables Verify until 6 digits are entered', async () => {
    await expect.element(verifyButton).toBeDisabled()

    await userEvent.fill(otpInput, '12345')
    await expect.element(verifyButton).toBeDisabled()

    await userEvent.fill(otpInput, '123456')
    await expect.element(verifyButton).toBeEnabled()
  })

  it('verifies the OTP, stores the user, and navigates', async () => {
    await userEvent.fill(otpInput, '123456')
    await userEvent.click(verifyButton)

    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledOnce())
    expect(apiFetch).toHaveBeenCalledWith('/api/auth/otp/verify', {
      method: 'POST',
      body: {
        challengeId: '65f0000000000000000000ab',
        code: '123456',
      },
    })
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com' })
    )
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
  })
})
