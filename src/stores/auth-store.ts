import { create } from 'zustand'
import { apiFetch } from '@/lib/api-client'

export interface AuthUser {
  id: string
  accountNo: string
  email: string
  role: string[]
  status?: 'active' | 'inactive' | 'invited' | 'suspended'
  firstName?: string
  lastName?: string
  mfaEnabled?: boolean
  modulePermissions?: string[]
}

/**
 * `pending` means the session has not been resolved against the server yet, so
 * guards must wait rather than treat the user as signed out.
 */
export type AuthStatus = 'pending' | 'authenticated' | 'unauthenticated'

type Credentials = { email: string; password: string }
/** rememberMe=false keeps the session only until the browser closes. */
type SignInCredentials = Credentials & { rememberMe?: boolean }
type SessionResponse = { user: AuthUser }
export type OtpRequiredResponse = {
  requiresOtp: true
  challengeId: string
  email: string
  expiresIn: number
  resendAfter: number
}
export type SignInResult = AuthUser | OtpRequiredResponse

interface AuthState {
  auth: {
    user: AuthUser | null
    status: AuthStatus
    setUser: (user: AuthUser | null) => void
    /** Resolves the session from the httpOnly cookies. Safe to call repeatedly. */
    hydrate: () => Promise<AuthUser | null>
    signIn: (credentials: SignInCredentials) => Promise<SignInResult>
    signUp: (credentials: Credentials) => Promise<AuthUser>
    signOut: () => Promise<void>
    /** Clears local state only — use signOut to also drop the server session. */
    reset: () => void
  }
}

/** Shared so concurrent route guards trigger a single /me request. */
let inFlightHydration: Promise<AuthUser | null> | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  function setAuth(patch: Partial<AuthState['auth']>) {
    set((state) => ({ ...state, auth: { ...state.auth, ...patch } }))
  }

  return {
    auth: {
      user: null,
      status: 'pending',

      setUser: (user) =>
        setAuth({
          user,
          status: user ? 'authenticated' : 'unauthenticated',
        }),

      hydrate: () => {
        if (!inFlightHydration) {
          inFlightHydration = apiFetch<SessionResponse>('/api/auth/me')
            .then(({ user }) => {
              get().auth.setUser(user)
              return user
            })
            .catch(() => {
              // Any failure here — 401, offline, server error — leaves the app
              // signed out rather than stuck on `pending`.
              get().auth.setUser(null)
              return null
            })
            .finally(() => {
              inFlightHydration = null
            })
        }
        return inFlightHydration
      },

      signIn: async (credentials) => {
        const response = await apiFetch<SessionResponse | OtpRequiredResponse>(
          '/api/auth/sign-in',
          {
            method: 'POST',
            body: credentials,
          }
        )
        if ('requiresOtp' in response) return response

        get().auth.setUser(response.user)
        return response.user
      },

      signUp: async (credentials) => {
        const { user } = await apiFetch<SessionResponse>('/api/auth/sign-up', {
          method: 'POST',
          body: credentials,
        })
        get().auth.setUser(user)
        return user
      },

      signOut: async () => {
        try {
          await apiFetch('/api/auth/sign-out', { method: 'POST' })
        } finally {
          // Clear locally even if the request failed, so the UI never shows a
          // signed-in state the user asked to leave.
          get().auth.reset()
        }
      },

      reset: () => setAuth({ user: null, status: 'unauthenticated' }),
    },
  }
})
