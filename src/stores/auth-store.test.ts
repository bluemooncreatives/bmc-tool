import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}))

async function importAuthStore() {
  // The store is a module singleton, so each test re-imports it to start from
  // a clean state (including the shared in-flight hydration promise).
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser = {
  id: '65f0000000000000000000aa',
  accountNo: 'ACC-1',
  email: 'user@example.com',
  role: ['user'],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('starts pending with no user until the session is resolved', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.status).toBe('pending')
  })

  it('hydrate stores the user returned by /api/auth/me', async () => {
    apiFetch.mockResolvedValueOnce({ user: sampleUser })
    const useAuthStore = await importAuthStore()

    const user = await useAuthStore.getState().auth.hydrate()

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/me')
    expect(user).toEqual(sampleUser)
    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
    expect(useAuthStore.getState().auth.status).toBe('authenticated')
  })

  it('hydrate resolves to unauthenticated when there is no session', async () => {
    apiFetch.mockRejectedValueOnce(new Error('401'))
    const useAuthStore = await importAuthStore()

    const user = await useAuthStore.getState().auth.hydrate()

    expect(user).toBeNull()
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.status).toBe('unauthenticated')
  })

  it('shares a single request between concurrent hydrate calls', async () => {
    apiFetch.mockResolvedValue({ user: sampleUser })
    const useAuthStore = await importAuthStore()
    const { auth } = useAuthStore.getState()

    await Promise.all([auth.hydrate(), auth.hydrate(), auth.hydrate()])

    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('signIn posts credentials and stores the returned user', async () => {
    apiFetch.mockResolvedValueOnce({ user: sampleUser })
    const useAuthStore = await importAuthStore()

    const user = await useAuthStore
      .getState()
      .auth.signIn({ email: 'user@example.com', password: 'secret123' })

    expect(apiFetch).toHaveBeenCalledWith('/api/auth/sign-in', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'secret123' },
    })
    expect(user).toEqual(sampleUser)
    expect(useAuthStore.getState().auth.status).toBe('authenticated')
  })

  it('signIn leaves the store untouched when the request fails', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Invalid email or password.'))
    const useAuthStore = await importAuthStore()

    await expect(
      useAuthStore
        .getState()
        .auth.signIn({ email: 'user@example.com', password: 'wrong' })
    ).rejects.toThrow('Invalid email or password.')

    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('signOut calls the endpoint and clears the user', async () => {
    apiFetch.mockResolvedValueOnce({ user: sampleUser })
    const useAuthStore = await importAuthStore()
    await useAuthStore
      .getState()
      .auth.signIn({ email: 'user@example.com', password: 'secret123' })

    apiFetch.mockResolvedValueOnce({ ok: true })
    await useAuthStore.getState().auth.signOut()

    expect(apiFetch).toHaveBeenLastCalledWith('/api/auth/sign-out', {
      method: 'POST',
    })
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.status).toBe('unauthenticated')
  })

  it('signOut clears the user even if the request fails', async () => {
    apiFetch.mockResolvedValueOnce({ user: sampleUser })
    const useAuthStore = await importAuthStore()
    await useAuthStore
      .getState()
      .auth.signIn({ email: 'user@example.com', password: 'secret123' })

    apiFetch.mockRejectedValueOnce(new Error('offline'))
    await expect(useAuthStore.getState().auth.signOut()).rejects.toThrow(
      'offline'
    )

    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('reset clears the user without calling the API', async () => {
    apiFetch.mockResolvedValueOnce({ user: sampleUser })
    const useAuthStore = await importAuthStore()
    await useAuthStore
      .getState()
      .auth.signIn({ email: 'user@example.com', password: 'secret123' })

    apiFetch.mockClear()
    useAuthStore.getState().auth.reset()

    expect(apiFetch).not.toHaveBeenCalled()
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.status).toBe('unauthenticated')
  })
})
