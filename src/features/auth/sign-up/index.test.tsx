import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { ApiError } from '@/lib/api-client'
import { SignUp } from './index'

const navigate = vi.fn()
const signUpMock = vi.fn(
  async ({ email }: { email: string; password: string }) => ({
    id: '65f0000000000000000000aa',
    accountNo: 'ACC-1',
    email,
    role: ['user'],
  })
)

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { signUp: signUpMock } }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('SignUp page', () => {
  let screen: RenderResult
  let emailInput: Locator
  let passwordInput: Locator
  let confirmPasswordInput: Locator
  let submitButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()

    screen = await render(<SignUp />)
    emailInput = screen.getByLabelText(/^Email Address$/i)
    passwordInput = screen.getByLabelText(/^Password$/i)
    confirmPasswordInput = screen.getByLabelText(/^Confirm Password$/i)
    submitButton = screen.getByRole('button', { name: /^Create Account$/i })
  })

  it('renders the fields and submit button', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(confirmPasswordInput).toBeInTheDocument()
    await expect.element(submitButton).toBeInTheDocument()
  })

  it('shows a mismatch error and does not submit when passwords differ', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, 'Secure123')
    await userEvent.fill(confirmPasswordInput, 'Secure124')
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText("Passwords don't match."))
      .toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, 'Short1')
    await userEvent.fill(confirmPasswordInput, 'Short1')
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText('Password must be at least 8 characters long.'))
      .toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('creates the account and navigates to the dashboard', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, 'Secure123')
    await userEvent.fill(confirmPasswordInput, 'Secure123')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(signUpMock).toHaveBeenCalledOnce())
    // confirmPassword is a client-side check only and is not sent.
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'Secure123',
    })

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })

  it('surfaces a server error and stays on the page', async () => {
    signUpMock.mockRejectedValueOnce(
      new ApiError('An account with that email already exists.', 409)
    )

    await userEvent.fill(emailInput, 'taken@b.com')
    await userEvent.fill(passwordInput, 'Secure123')
    await userEvent.fill(confirmPasswordInput, 'Secure123')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(signUpMock).toHaveBeenCalledOnce())
    await expect
      .element(screen.getByText('An account with that email already exists.'))
      .toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
