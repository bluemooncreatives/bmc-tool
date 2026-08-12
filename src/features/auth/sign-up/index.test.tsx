import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { ApiError } from '@/lib/api-client'
import { SignUp } from './index'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original()),
  apiFetch: mocks.apiFetch,
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { signUp: mocks.signUp } }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const organizations = [
  {
    id: 'internal',
    code: 'BMC',
    name: 'Blue Moon Creatives',
    type: 'internal',
    allowSelfSignUp: true,
  },
  {
    id: 'acme',
    code: 'ACME',
    name: 'Acme Studios',
    type: 'client',
    allowSelfSignUp: true,
  },
  {
    id: 'northstar',
    code: 'NORTHSTAR',
    name: 'Northstar Partners',
    type: 'partner',
    allowSelfSignUp: true,
  },
]

async function renderPage() {
  const screen = await render(<SignUp />)
  await expect
    .element(screen.getByRole('combobox', { name: 'Organization' }))
    .toBeEnabled()
  return screen
}

async function selectAcme(screen: RenderResult) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Organization' }))
  await userEvent.click(screen.getByRole('option', { name: /Acme Studios/i }))
}

async function fillValidAccount(screen: RenderResult) {
  await userEvent.fill(screen.getByLabelText(/^Username$/i), 'alex')
  await userEvent.fill(screen.getByLabelText(/^Email Address$/i), 'a@b.com')
  await userEvent.fill(screen.getByLabelText(/^Password$/i), 'Secure123')
  await userEvent.fill(
    screen.getByLabelText(/^Confirm Password$/i),
    'Secure123'
  )
}

describe('SignUp page organization picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiFetch.mockResolvedValue({ organizations })
    mocks.signUp.mockImplementation(async ({ email }: { email: string }) => ({
      id: '65f0000000000000000000000aa',
      accountNo: 'ACME-1',
      email,
      username: 'alex',
      displayEmail: email,
      role: ['user'],
    }))
  })

  it('uses a dropdown and never renders the internal organization', async () => {
    const screen = await renderPage()
    const organization = screen.getByRole('combobox', {
      name: 'Organization',
    })

    await expect
      .element(organization)
      .toHaveTextContent('Select an organization')
    await userEvent.click(organization)
    await expect
      .element(screen.getByRole('option', { name: /Acme Studios/i }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('option', { name: /Northstar Partners/i }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('option', { name: /Blue Moon Creatives/i }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByPlaceholder('Organization code, e.g. ACME'))
      .not.toBeInTheDocument()
  })

  it('submits the selected organization code with the account', async () => {
    const screen = await renderPage()
    const submit = screen.getByRole('button', { name: 'Create Account' })
    await expect.element(submit).toBeDisabled()

    await selectAcme(screen)
    await fillValidAccount(screen)
    await expect.element(submit).toBeEnabled()
    await userEvent.click(submit)

    await vi.waitFor(() => expect(mocks.signUp).toHaveBeenCalledOnce())
    expect(mocks.signUp).toHaveBeenCalledWith({
      organizationCode: 'ACME',
      email: 'a@b.com',
      username: 'alex',
      password: 'Secure123',
    })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
  })

  it('keeps sign-up disabled when no external organization is eligible', async () => {
    mocks.apiFetch.mockResolvedValueOnce({ organizations: [organizations[0]] })
    const screen = await render(<SignUp />)

    await expect
      .element(screen.getByText('No organizations accepting sign-ups'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Create Account' }))
      .toBeDisabled()
  })

  it('shows a retry state when the organization directory fails', async () => {
    mocks.apiFetch
      .mockRejectedValueOnce(new ApiError('Could not load organizations.', 503))
      .mockResolvedValueOnce({ organizations })
    const screen = await render(<SignUp />)

    await expect
      .element(screen.getByText('Could not load organizations.'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Create Account' }))
      .toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await expect
      .element(screen.getByRole('combobox', { name: 'Organization' }))
      .toBeEnabled()
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2)
  })

  it('validates password confirmation before submitting', async () => {
    const screen = await renderPage()
    await selectAcme(screen)
    await userEvent.fill(screen.getByLabelText(/^Username$/i), 'alex')
    await userEvent.fill(screen.getByLabelText(/^Email Address$/i), 'a@b.com')
    await userEvent.fill(screen.getByLabelText(/^Password$/i), 'Secure123')
    await userEvent.fill(
      screen.getByLabelText(/^Confirm Password$/i),
      'Secure124'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Account' })
    )

    await expect
      .element(screen.getByText("Passwords don't match."))
      .toBeInTheDocument()
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('surfaces a server rejection without losing the selected organization', async () => {
    mocks.signUp.mockRejectedValueOnce(
      new ApiError('That organization is no longer accepting sign-ups.', 403)
    )
    const screen = await renderPage()
    await selectAcme(screen)
    await fillValidAccount(screen)
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Account' })
    )

    await expect
      .element(
        screen.getByText('That organization is no longer accepting sign-ups.')
      )
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('combobox', { name: 'Organization' }))
      .toHaveTextContent('Acme Studios')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
