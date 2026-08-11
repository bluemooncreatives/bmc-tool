import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { ApiError } from '@/lib/api-client'
import { SignIn } from './index'

const navigate = vi.fn()
const search = vi.fn(() => ({}) as { redirect?: string })
const signInMock = vi.fn(
  async ({ email }: { email: string; password: string }) => ({
    id: '65f0000000000000000000aa',
    accountNo: 'ACC-1',
    email,
    role: ['user'],
  })
)

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { signIn: signInMock } }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => search(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('SignIn page', () => {
  let screen: RenderResult
  let emailInput: Locator
  let passwordInput: Locator
  let submitButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    search.mockReturnValue({})

    screen = await render(<SignIn />)
    emailInput = screen.getByLabelText(/^Email Address$/i)
    passwordInput = screen.getByLabelText(/^Password$/i)
    submitButton = screen.getByRole('button', { name: /^Sign In$/i })
  })

  it('signs in and navigates to the dashboard by default', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
    // "Keep me signed in" defaults to checked.
    expect(signInMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: '1234567',
      rememberMe: true,
    })

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })

  it('sends rememberMe: false when the checkbox is cleared', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.click(screen.getByLabelText(/Keep me signed in/i))
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
    expect(signInMock).toHaveBeenCalledWith(
      expect.objectContaining({ rememberMe: false })
    )
  })

  it('returns to the redirect target recorded by the route guard', async () => {
    search.mockReturnValue({ redirect: '/settings' })
    screen = await render(<SignIn />)

    await userEvent.fill(
      screen.getByLabelText(/^Email Address$/i),
      'a@b.com'
    )
    await userEvent.fill(screen.getByLabelText(/^Password$/i), '1234567')
    await userEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/settings', replace: true })
    )
  })

  it('shows the server message and stays put on bad credentials', async () => {
    signInMock.mockRejectedValueOnce(
      new ApiError('Invalid email or password.', 401)
    )

    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, 'wrongpass')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
    await expect
      .element(screen.getByText('Invalid email or password.'))
      .toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('toggles password visibility', async () => {
    await expect.element(passwordInput).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: /Show password/i }))
    await expect.element(passwordInput).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: /Hide password/i }))
    await expect.element(passwordInput).toHaveAttribute('type', 'password')
  })
})
